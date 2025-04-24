// auth and role redirect
// Uses variables from firebase-config.js (auth, db, ROLES)

// School location (for geofencing)
const SCHOOL_LOCATION = {
  lat: 18.5204, // Replace with your school's latitude
  lng: 73.8567,  // Replace with your school's longitude
  radius: 500
};

// For regular login - THIS MUST BE GLOBAL (no 'function' prefix)
function loginWithCredentials() {
    console.log("loginWithCredentials function called");
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    if (!email || !password) {
        document.getElementById('error-message').textContent = 'Please enter both email and password';
        return;
    }
    
    auth.signInWithEmailAndPassword(email, password)
        .then(userCredential => {
            // Get user role from Firestore
            db.collection('users').doc(userCredential.user.uid).get()
                .then(doc => {
                    if (doc.exists) {
                        const userData = doc.data();
                        redirectBasedOnRole(userData.role);
                    } else {
                        document.getElementById('error-message').textContent = 'User data not found';
                    }
                })
                .catch(error => {
                    document.getElementById('error-message').textContent = error.message;
                });
        })
        .catch(error => {
            document.getElementById('error-message').textContent = error.message;
        });
}

// For Google login - THIS MUST BE GLOBAL
function loginWithGoogle() {
    console.log("loginWithGoogle function called");
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider)
        .then(result => {
            // Get user role from Firestore
            db.collection('users').doc(result.user.uid).get()
                .then(doc => {
                    if (doc.exists) {
                        const userData = doc.data();
                        redirectBasedOnRole(userData.role);
                    } else {
                        // If user data doesn't exist, create it
                        const userData = {
                            name: result.user.displayName,
                            email: result.user.email,
                            role: 'student', // Default role
                            createdAt: firebase.firestore.FieldValue.serverTimestamp()
                        };
                        
                        db.collection('users').doc(result.user.uid).set(userData)
                            .then(() => {
                                redirectBasedOnRole('student');
                            })
                            .catch(error => {
                                document.getElementById('error-message').textContent = error.message;
                            });
                    }
                })
                .catch(error => {
                    document.getElementById('error-message').textContent = error.message;
                });
        })
        .catch(error => {
            document.getElementById('error-message').textContent = error.message;
        });
}

// Function to redirect user based on their role
function redirectBasedOnRole(role) {
    console.log("Redirecting based on role:", role);
    switch (role) {
        case ROLES.ADMIN:
            window.location.href = 'admin.html';
            break;
        case ROLES.TEACHER:
            window.location.href = 'teacher.html';
            break;
        case ROLES.STUDENT:
            window.location.href = 'dashboard.html';
            break;
        default:
            console.warn("Unknown role:", role);
            // Redirect to login page if role is unknown
            window.location.href = 'index.html';
            break;
    }
}

// Function to create a new account
function createAccount() {
  const name = document.getElementById('name').value;
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  
  // Use the hidden role field instead of the dropdown directly
  const role = document.getElementById('actual-role').value;
  
  if (!name || !email || !password) {
      document.getElementById('error-message').textContent = 'Please fill all required fields';
      return;
  }
  
  // Create user with email and password
  firebase.auth().createUserWithEmailAndPassword(email, password)
      .then(userCredential => {
          const user = userCredential.user;
          
          // Build user data object
          let userData = {
              name: name,
              email: email,
              role: role,
              createdAt: firebase.firestore.FieldValue.serverTimestamp()
          };
          
          // Add role-specific data
          if (role === ROLES.STUDENT) {
              userData.studentId = document.getElementById('student-id')?.value || email.split('@')[0]; 
              userData.className = document.getElementById('class-name')?.value || '';
          } else if (role === ROLES.TEACHER) {
              userData.department = document.getElementById('department')?.value || '';
          }
          
          // Save user data to Firestore
          return db.collection('users').doc(user.uid).set(userData);
      })
      .then(() => {
          // Redirect based on role
          redirectBasedOnRole(role);
      })
      .catch(error => {
          document.getElementById('error-message').textContent = error.message;
      });
}

// Function to log out
function logout() {
  console.log("Logout initiated...");
  
  firebase.auth().signOut()
      .then(() => {
          console.log("Successfully logged out");
          // Clear any session data
          sessionStorage.clear();
          localStorage.removeItem('currentUser');
          
          // Redirect to login page
          window.location.href = 'index.html';
      })
      .catch((error) => {
          console.error("Error during logout:", error);
          alert("Failed to log out. Please try again.");
      });
}

// Function to delete user account
function deleteUserAccount() {
  // Show confirmation dialog
  if (!confirm("Are you sure you want to delete your account? This action cannot be undone.")) {
      return;
  }
  
  // Get current user
  const user = firebase.auth().currentUser;
  if (!user) {
      showToast('Error', 'You must be logged in to delete your account', 'error');
      return;
  }
  
  // Reference to user document
  const userRef = db.collection('users').doc(user.uid);
  
  // Start deletion process
  showToast('Info', 'Deleting your account, please wait...', 'info');
  
  // Get user role to handle role-specific cleanup
  userRef.get()
      .then(doc => {
          if (!doc.exists) {
              throw new Error('User document not found');
          }
          
          const userData = doc.data();
          const userRole = userData.role;
          
          // Begin a batch operation to delete related documents
          const batch = db.batch();
          
          // Delete the user document
          batch.delete(userRef);
          
          // Handle role-specific cleanup
          if (userRole === 'teacher') {
              // Get all classrooms created by this teacher
              return db.collection('classrooms')
                  .where('teacherId', '==', user.uid)
                  .get()
                  .then(snapshot => {
                      // Delete each classroom
                      snapshot.forEach(doc => {
                          batch.delete(doc.ref);
                      });
                      
                      // Get all attendance sessions created by this teacher
                      return db.collection('attendanceSessions')
                          .where('teacherId', '==', user.uid)
                          .get();
                  })
                  .then(snapshot => {
                      // Delete each attendance session
                      snapshot.forEach(doc => {
                          batch.delete(doc.ref);
                      });
                      
                      // Commit the batch
                      return batch.commit();
                  });
          } else if (userRole === 'student') {
              // Get all classroom memberships for this student
              return db.collection('classroomMembers')
                  .where('studentId', '==', user.uid)
                  .get()
                  .then(snapshot => {
                      // Delete each membership
                      snapshot.forEach(doc => {
                          batch.delete(doc.ref);
                      });
                      
                      // Get all attendance records for this student
                      return db.collection('attendance')
                          .where('studentId', '==', user.uid)
                          .get();
                  })
                  .then(snapshot => {
                      // Delete each attendance record
                      snapshot.forEach(doc => {
                          batch.delete(doc.ref);
                      });
                      
                      // Commit the batch
                      return batch.commit();
                  });
          } else {
              // For admin or other roles, just commit the batch
              return batch.commit();
          }
      })
      .then(() => {
          // Finally, delete the Firebase Auth user
          return user.delete();
      })
      .then(() => {
          showToast('Success', 'Your account has been deleted successfully', 'success');
          
          // Clear any local storage
          localStorage.clear();
          sessionStorage.clear();
          
          // Redirect to login page
          setTimeout(() => {
              window.location.href = 'index.html';
          }, 2000);
      })
      .catch(error => {
          console.error('Error deleting account:', error);
          
          // Check for auth errors that require recent login
          if (error.code === 'auth/requires-recent-login') {
              showToast('Error', 'Please log out and log in again to delete your account', 'error');
          } else {
              showToast('Error', 'Failed to delete account: ' + error.message, 'error');
          }
      });
}

// Add this at the end of auth.js to verify the functions are defined
console.log("Auth.js loaded successfully");
console.log("Functions defined:", {
  loginWithCredentials: typeof loginWithCredentials === 'function',
  loginWithGoogle: typeof loginWithGoogle === 'function'
});