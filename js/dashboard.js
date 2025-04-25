// Create dashboard.js if it doesn't exist
let myClassryooms = [];
let currentUser = null; // Add this global user variable

// Add this function at the top of your file
function ensureAuthenticated() {
    if (!currentUser) {
        // Get current user if not set but user is authenticated
        const user = firebase.auth().currentUser;
        if (user) {
            currentUser = user;
            return true;
        }
        
        // Not authenticated, redirect to login
        console.warn("User not authenticated, redirecting to login");
        window.location.href = 'index.html';
        return false;
    }
    return true;
}

// Add these functions if they don't exist
// Create a browser notification
function createBrowserNotification(title, message, type) {
    // Get icon based on notification type
    let icon = '/favicon.ico'; // Default icon - you can replace this with your own
    if (type === 'success') icon = 'https://cdn-icons-png.flaticon.com/512/190/190411.png';
    if (type === 'error') icon = 'https://cdn-icons-png.flaticon.com/512/1828/1828843.png';
    if (type === 'warning') icon = 'https://cdn-icons-png.flaticon.com/512/564/564619.png';
    
    // Create and show notification
    const notification = new Notification(title, {
        body: message,
        icon: icon
    });
    
    // Close notification after 5 seconds
    setTimeout(() => notification.close(), 5000);
    
    // Handle notification click
    notification.onclick = function() {
        window.focus();
        notification.close();
    };
}

// Fallback to modal dialog when notifications aren't available
function showFallbackNotification(title, message, type) {
    // Create modal if it doesn't exist
    let modal = document.getElementById('notification-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'notification-modal';
        modal.className = 'notification-modal';
        modal.innerHTML = `
            <div class="notification-content">
                <div class="notification-header">
                    <span class="notification-title"></span>
                    <button class="notification-close">&times;</button>
                </div>
                <div class="notification-body"></div>
            </div>
        `;
        document.body.appendChild(modal);
        
        // Close handler
        modal.querySelector('.notification-close').addEventListener('click', () => {
            modal.style.display = 'none';
        });
    }
    
    // Update modal content
    modal.querySelector('.notification-title').textContent = title;
    modal.querySelector('.notification-body').textContent = message;
    
    // Set type-based styling
    modal.className = `notification-modal ${type}`;
    
    // Show modal
    modal.style.display = 'flex';
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        modal.style.display = 'none';
    }, 5000);
}

// Join a classroom using code
function joinClassroom() {
    const joinCodeInput = document.getElementById('join-code');
    const joinCode = joinCodeInput.value.trim();

    if (!joinCode) {
        alert("Please enter a valid classroom code.");
        return;
    }

    // Find the classroom by join code
    firebase.firestore().collection('classrooms')
        .where('joinCode', '==', joinCode)
        .get()
        .then(snapshot => {
            if (snapshot.empty) {
                alert("No classroom found with the given code.");
                return;
            }
            snapshot.forEach(doc => {
                const classroom = doc.data();
                const classroomId = doc.id;
                // Add membership record for the student
                firebase.firestore().collection('classroomMembers').add({
                    classroomId: classroomId,
                    studentId: currentUser.uid,
                    joinedAt: firebase.firestore.FieldValue.serverTimestamp()
                })
                .then(() => {
                    alert("Joined classroom: " + (classroom.name || 'Unnamed Class'));
                    joinCodeInput.value = '';
                    loadMyClassrooms(); // Refresh the classroom list
                })
                .catch(error => {
                    console.error("Error adding membership record:", error);
                    if (error.message.toLowerCase().includes("network")) {
                        if (confirm("Network error occurred while joining classroom. Would you like to remove any partial join (if exists) from your list?")) {
                            // Call removeClassroom if a faulty membership record exists.
                            // In a real-world scenario, you may want to search for an existing membership record by joinCode.
                            // For example, you could prompt the user to select the classroom to remove.
                            removeClassroomByCode(joinCode);
                        }
                    } else {
                        alert("Error joining classroom. Please try again later.");
                    }
                });
            });
        })
        .catch(error => {
            console.error("Error finding classroom:", error);
            alert("Error joining classroom. Please try again later.");
        });
}

// New function to remove classroom membership by join code (if partial join exists)
function removeClassroomByCode(joinCode) {
    // Query membership records by the joinCode.
    // This assumes your 'classrooms' collection stores a unique joinCode.
    firebase.firestore().collection('classrooms')
        .where('joinCode', '==', joinCode)
        .get()
        .then(snapshot => {
            if (snapshot.empty) {
                alert("No classroom membership to remove.");
                return;
            }
            snapshot.forEach(classDoc => {
                const classroomId = classDoc.id;
                // Find the membership record for this classroom and current user
                firebase.firestore().collection('classroomMembers')
                    .where('classroomId', '==', classroomId)
                    .where('studentId', '==', currentUser.uid)
                    .get()
                    .then(memSnap => {
                        if (memSnap.empty) {
                            alert("No membership record found to remove.");
                        } else {
                            memSnap.forEach(memDoc => {
                                firebase.firestore().collection('classroomMembers').doc(memDoc.id).delete()
                                    .then(() => {
                                        alert("Membership removed successfully.");
                                        loadMyClassrooms();
                                    })
                                    .catch(err => {
                                        console.error("Error removing membership:", err);
                                        alert("Error removing classroom membership: " + err.message);
                                    });
                            });
                        }
                    })
                    .catch(err => {
                        console.error("Error querying membership records:", err);
                    });
            });
        })
        .catch(error => {
            console.error("Error finding classroom by code:", error);
        });
}

// Alternatively, you might expose a "Leave Class" button on each classroom card.
// For that, use this function with the membership document id.
function removeClassroom(membershipId) {
    if (confirm("Are you sure you want to leave this classroom?")) {
        firebase.firestore().collection('classroomMembers').doc(membershipId).delete()
            .then(() => {
                alert("You have left the classroom.");
                loadMyClassrooms();
            })
            .catch(error => {
                alert("Error leaving classroom: " + error.message);
            });
    }
}

// Load my classrooms (joined classes)
function loadMyClassrooms() {
    if (!currentUser) return;
    
    // Change 'my-classrooms-list' to 'classrooms-list' to match the HTML element's id
    const classroomsList = document.getElementById('classrooms-list');
    if (!classroomsList) {
        console.error("Element 'classrooms-list' not found in DOM");
        return;
    }
    classroomsList.innerHTML = '<p>Loading your classrooms...</p>';
    
    db.collection('classroomMembers')
        .where('studentId', '==', currentUser.uid)
        .get()
        .then(snapshot => {
            if (snapshot.empty) {
                classroomsList.innerHTML = '<p>You haven\'t joined any classrooms yet. Use a classroom code to join one.</p>';
                return;
            }
            
            classroomsList.innerHTML = '';
            let promises = [];
            snapshot.forEach(doc => {
                const membership = doc.data();
                promises.push(
                    db.collection('classrooms')
                        .doc(membership.classroomId)
                        .get()
                        .then(classroomDoc => {
                            if (classroomDoc.exists) {
                                const classroom = classroomDoc.data();
                                const classroomId = classroomDoc.id;
                                
                                const classroomCard = document.createElement('div');
                                classroomCard.className = 'classroom-card mb-3';
                                // UPDATED TEMPLATE WITH MARK ATTENDANCE BUTTON
                                classroomCard.innerHTML = `
                                    <div class="card">
                                        <div class="card-header">
                                            <h4>${classroom.name || 'Unknown Class'}</h4>
                                        </div>
                                        <div class="card-body">
                                            <div class="subject-code">
                                                <span class="code-label"><strong>Code:</strong> ${classroom.joinCode || 'N/A'}</span>
                                                <button class="btn-mark-attendance" onclick="markAttendance('${classroomId}', '${classroom.joinCode || ''}')">
                                                    <i class="fas fa-check-circle"></i> Mark Attendance
                                                </button>
                                            </div>
                                            <p><strong>Subject:</strong> ${classroom.subject || 'Not specified'}</p>
                                            <p><strong>Teacher:</strong> ${classroom.teacherName || 'Unknown'}</p>
                                            <div class="card-actions">
                                                <button class="btn btn-sm btn-primary" onclick="viewClassroomDetails('${classroomId}')">View Details</button>
                                            </div>
                                        </div>
                                    </div>
                                `;
                                classroomsList.appendChild(classroomCard);
                            }
                        })
                        .catch(error => {
                            console.error("Error loading classroom details:", error);
                        })
                );
            });
            Promise.all(promises).catch(error => {
                console.error("Error loading classroom details:", error);
            });
        })
        .catch(error => {
            console.error("Error loading classrooms:", error);
            classroomsList.innerHTML = '<p>Error loading your classrooms. Please try again later.</p>';
        });
}

// Placeholder for view classroom details function
function viewClassroomDetails(classroomId) {
    showToast('Info', 'Classroom details view will be implemented soon', 'info');
}

// Load attendance statistics
function loadAttendanceStats() {
    if (!currentUser) return;
    
    db.collection('attendance')
        .where('studentId', '==', currentUser.uid)
        .get()
        .then(snapshot => {
            let presentCount = 0;
            let absentCount = 0;
            snapshot.forEach(doc => {
                const record = doc.data();
                if (record.status === 'present' || record.status === 'Present') {
                    presentCount++;
                } else if (record.status === 'absent' || record.status === 'Absent') {
                    absentCount++;
                }
            });
            
            const totalClasses = presentCount + absentCount;
            const attendancePercentage = totalClasses > 0 
                ? Math.round((presentCount / totalClasses) * 100) 
                : 0;
            
            document.getElementById('present-count').textContent = presentCount;
            document.getElementById('absent-count').textContent = absentCount;
            document.getElementById('attendance-percentage').textContent = attendancePercentage + '%';
        })
        .catch(error => {
            console.error("Error loading attendance statistics:", error);
        });
}

// Mark attendance for a specific classroom
function markAttendance(classroomId, classCode) {
    if (!ensureAuthenticated()) return;
    
    showToast('Processing', 'Marking your attendance...', 'info');
    
    // Check for an active attendance session in the classroom
    db.collection('attendanceSessions')
      .where('classroomId', '==', classroomId)
      .where('active', '==', true)
      .get()
      .then(snapshot => {
         if (snapshot.empty) {
             showToast('No Active Session', 'There is no active session at the moment.', 'warning');
             return;
         }
         // Get the first active session
         const sessionDoc = snapshot.docs[0];
         const sessionId = sessionDoc.id;
         
         // First check if the student already marked attendance in this session
         db.collection('attendance')
            .where('sessionId', '==', sessionId)
            .where('studentId', '==', currentUser.uid)
            .get()
            .then(existingSnap => {
                if (!existingSnap.empty) {
                   showToast('Already Marked', 'You have already marked attendance for this session.', 'info');
                   return;
                }
                // For demo purposes, mark attendance immediately without using location
                db.collection('attendance').add({
                    sessionId: sessionId,
                    studentId: currentUser.uid,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                    status: 'present',
                    deviceInfo: navigator.userAgent,
                    demoMode: true
                })
                .then(() => {
                    showToast('Success', 'Your attendance has been marked!', 'success');
                    loadAttendanceStats();
                })
                .catch(error => {
                    showToast('Error', 'Failed to mark attendance: ' + error.message, 'error');
                });
            })
            .catch(error => {
                showToast('Error', 'Failed to check attendance records: ' + error.message, 'error');
            });
      })
      .catch(error => {
         showToast('Error', 'Failed to check sessions: ' + error.message, 'error');
      });
}

// New helper function to mark attendance without location
function markAttendanceWithoutLocation(sessionId, sessionData) {
    showToast('Location Unavailable', 'Marking attendance without location verification', 'warning');
    
    db.collection('attendance').add({
        sessionId: sessionId,
        studentId: currentUser.uid, // Use currentUser here
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        status: 'present', // Default to present when no location
        deviceInfo: navigator.userAgent,
        noLocation: true // Flag that this was marked without location
    })
    .then(() => {
        showToast('Success', 'Attendance marked successfully without location verification', 'success');
        loadAttendanceStats();
    })
    .catch(error => {
        showToast('Error', 'Failed to mark attendance: ' + error.message, 'error');
    });
}

// Check location permission
function checkLocationPermission() {
    return new Promise((resolve) => {
        if (navigator.permissions && navigator.permissions.query) {
            navigator.permissions.query({ name: 'geolocation' })
                .then(result => {
                    if (result.state === 'denied') {
                        showToast('Location Access Denied', 'Please enable location access in your browser settings', 'warning');
                        resolve(false);
                    } else if (result.state === 'granted') {
                        resolve(true);
                    } else {
                        resolve(true); // Will show browser permission dialog
                    }
                })
                .catch(() => resolve(true)); // Try anyway if permissions API fails
        } else {
            resolve(true); // Can't check permissions, try anyway
        }
    });
}

// Calculate distance between two points using Haversine formula
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth radius in meters
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180; // This was backwards: (lon1-lon2)
    
    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    
    return R * c; // Distance in meters
}

// Update your existing DOMContentLoaded event
document.addEventListener('DOMContentLoaded', function() {
    console.log("Dashboard.js loaded");
    
    // Check authentication
    firebase.auth().onAuthStateChanged(function(user) {
        if (!user) {
            console.warn("No authenticated user, redirecting to login");
            window.location.href = 'index.html';
            return;
        }

        console.log("User authenticated:", user.uid);
        // Set the global user variable
        currentUser = user; // Store user in the global variable
        
        // Rest of your code remains the same
        db.collection('users').doc(user.uid).get()
            .then(doc => {
                if (doc.exists) {
                    const userData = doc.data();
                    
                    document.getElementById('user-name').textContent = userData.name || 'Student';
                    document.getElementById('student-name').textContent = userData.name || 'Student';
                    document.getElementById('user-email').textContent = userData.email || '';
                    
                    // Set avatar with first letter of name
                    const name = userData.name || 'S';
                    const initials = name.charAt(0);
                    document.getElementById('user-avatar').src = `https://ui-avatars.com/api/?name=${initials}&background=random`;
                    
                    // Load classrooms and attendance stats
                    loadMyClassrooms();
                    loadAttendanceStats();
                }
            })
            .catch(error => {
                console.error("Error loading user data:", error);
            });
    });
});