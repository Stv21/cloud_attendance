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
    if (!currentUser) {
        showToast('Error', 'You must be logged in to join a classroom', 'error');
        return;
    }
    
    const joinCodeInput = document.getElementById('join-code');
    const joinCode = joinCodeInput.value.trim();
    
    if (!joinCode) {
        showToast('Error', 'Please enter a classroom code', 'error');
        return;
    }
    
   
    
    // Find the classroom by join code
    db.collection('classrooms')
        .where('joinCode', '==', joinCode)
        .get()
        .then(snapshot => {
            if (snapshot.empty) {
                showToast('Error', 'Invalid classroom code. Please check and try again.', 'error');
                return;
            }
            
            let promises = [];
            let classroomName = "the classroom"; // Default name

            snapshot.forEach(doc => {
                const classroomData = doc.data();
                classroomName = classroomData.name || "the classroom";
                
                promises.push(
                    db.collection('classrooms')
                        .doc(classroomData.classroomId)
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
                            console.error("Error checking membership:", error);
                            showToast('Error', 'Failed to join classroom. Please try again.', 'error');
                        })
                );
            });
            Promise.all(promises)
                .then(() => {
                    showToast('Success', `You have joined "${classroomName}"`, 'success');
                    joinCodeInput.value = '';
                    loadMyClassrooms();
                })
                .catch(error => {
                    console.error("Error joining classroom:", error);
                    showToast('Error', 'Failed to join classroom. Please try again.', 'error');
                });
        })
        .catch(error => {
            console.error("Error finding classroom:", error);
            showToast('Error', 'Failed to find classroom. Please try again.', 'error');
        });
}

// Load my classrooms (joined classes)
function loadMyClassrooms() {
    if (!currentUser) return;
    
    const classroomsList = document.getElementById('my-classrooms-list');
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
    // Ensure user is authenticated
    if (!ensureAuthenticated()) return;
    
    // Show loading state
    showToast('Checking', 'Looking for active attendance session...', 'info');
    
    // Check for active sessions in this classroom
    db.collection('attendanceSessions')
        .where('classroomId', '==', classroomId)
        .where('active', '==', true)
        .get()
        .then(snapshot => {
            if (snapshot.empty) {
                showToast('No Active Session', 'There is no active attendance session for this class at the moment. Please try again later.', 'warning');
                return;
            }
            
            // Get the active session
            const sessionDoc = snapshot.docs[0];
            const sessionId = sessionDoc.id;
            const sessionData = sessionDoc.data();
            console.log("Session data:", sessionData); // Debug session data
            
            // Check if student already marked attendance for this session
            db.collection('attendance')
                .where('sessionId', '==', sessionId)
                .where('studentId', '==', currentUser.uid)
                .get()
                .then(attSnapshot => {
                    if (!attSnapshot.empty) {
                        showToast('Already Marked', 'You have already marked your attendance for this session', 'info');
                        return;
                    }
                    
                    // Check location permission
                    checkLocationPermission().then(hasPermission => {
                        if (!hasPermission) {
                            markAttendanceWithoutLocation(sessionId, sessionData);
                            return;
                        }
                        
                        // Request with high accuracy
                        showToast('Getting Location', 'Please allow location access when prompted...', 'info');
                        navigator.geolocation.getCurrentPosition(
                            position => {
                                const studentLat = position.coords.latitude;
                                const studentLng = position.coords.longitude;
                                
                                // Check if session has location data
                                if (!sessionData.location) {
                                    console.warn("Session has no location data, marking without location verification");
                                    db.collection('attendance').add({
                                        sessionId: sessionId,
                                        studentId: currentUser.uid,
                                        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                                        status: 'present',
                                        deviceInfo: navigator.userAgent,
                                        noLocationVerification: true
                                    })
                                    .then(() => {
                                        showToast('Success', 'Attendance marked successfully', 'success');
                                        loadAttendanceStats();
                                    })
                                    .catch(error => {
                                        showToast('Error', 'Failed to mark attendance: ' + error.message, 'error');
                                    });
                                    return;
                                }
                                
                                // Safely access location data with fallbacks
                                const teacherLat = sessionData.location.latitude;
                                const teacherLng = sessionData.location.longitude;
                                
                                // Calculate distance using Haversine formula
                                const distance = calculateDistance(
                                    studentLat, studentLng, 
                                    teacherLat, teacherLng
                                );
                                
                                // Check if student is within allowed radius
                                const maxDistanceAllowed = sessionData.radius || 100; // Default to 100m
                                
                                // Record the attendance
                                db.collection('attendance').add({
                                    sessionId: sessionId,
                                    studentId: currentUser.uid,
                                    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                                    location: new firebase.firestore.GeoPoint(studentLat, studentLng),
                                    distance: distance,
                                    status: distance <= maxDistanceAllowed ? 'present' : 'absent',
                                    deviceInfo: navigator.userAgent
                                })
                                .then(() => {
                                    if (distance <= maxDistanceAllowed) {
                                        showToast('Success', 'Your attendance has been marked as present!', 'success');
                                    } else {
                                        showToast('Warning', `You are ${Math.round(distance)}m away from class location. Marked as absent.`, 'warning');
                                    }
                                    
                                    // Refresh the stats
                                    loadAttendanceStats();
                                })
                                .catch(error => {
                                    showToast('Error', 'Failed to mark attendance: ' + error.message, 'error');
                                });
                            },
                            error => {
                                console.error("Geolocation error:", error);
                                markAttendanceWithoutLocation(sessionId, sessionData);
                            },
                            {
                                enableHighAccuracy: true,
                                timeout: 10000,
                                maximumAge: 0
                            }
                        );
                    });
                })
                .catch(error => {
                    showToast('Error', 'Failed to check active sessions: ' + error.message, 'error');
                });
        })
        .catch(error => {
            showToast('Error', 'Failed to check active sessions: ' + error.message, 'error');
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