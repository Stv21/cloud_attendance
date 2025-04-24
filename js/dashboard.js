// Create dashboard.js if it doesn't exist
let myClassrooms = [];

// Join a classroom using code
function joinClassroom() {
    const user = firebase.auth().currentUser;
    if (!user) {
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
            
            const classroom = snapshot.docs[0].data();
            const classroomId = snapshot.docs[0].id;
            
            // Check if already a member
            db.collection('classroomMembers')
                .where('classroomId', '==', classroomId)
                .where('studentId', '==', user.uid)
                .get()
                .then(membershipSnapshot => {
                    if (!membershipSnapshot.empty) {
                        showToast('Info', 'You are already a member of this classroom', 'info');
                        return;
                    }
                    
                    // Add as member
                    db.collection('classroomMembers').add({
                        classroomId: classroomId,
                        classroomName: classroom.name,
                        classroomSubject: classroom.subject,
                        studentId: user.uid,
                        studentName: user.displayName || 'Student',
                        joinedAt: firebase.firestore.FieldValue.serverTimestamp()
                    })
                    .then(() => {
                        // Update student count in classroom
                        db.collection('classrooms').doc(classroomId).update({
                            studentCount: firebase.firestore.FieldValue.increment(1)
                        });
                        
                        showToast('Success', `You have joined "${classroom.name}"`, 'success');
                        joinCodeInput.value = '';
                        loadMyClassrooms();
                    })
                    .catch(error => {
                        console.error("Error joining classroom:", error);
                        showToast('Error', 'Failed to join classroom. Please try again.', 'error');
                    });
                })
                .catch(error => {
                    console.error("Error checking membership:", error);
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
    const user = firebase.auth().currentUser;
    if (!user) return;
    
    const classroomsList = document.getElementById('my-classrooms-list');
    classroomsList.innerHTML = '<p>Loading your classrooms...</p>';
    
    db.collection('classroomMembers')
        .where('studentId', '==', user.uid)
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
    const user = firebase.auth().currentUser;
    if (!user) return;
    
    db.collection('attendance')
        .where('studentId', '==', user.uid)
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
                .where('studentId', '==', user.uid)
                .get()
                .then(attSnapshot => {
                    if (!attSnapshot.empty) {
                        showToast('Already Marked', 'You have already marked your attendance for this session', 'info');
                        return;
                    }

                    // Check if location permission is available
                    checkLocationPermission().then(hasPermission => {
                        if (!hasPermission) {
                            // Allow marking attendance without location as fallback
                            markAttendanceWithoutLocation(sessionId, sessionData);
                            return;
                        }
                        
                        // Get user's current location
                        if (navigator.geolocation) {
                            showToast('Getting Location', 'Please allow location access when prompted...', 'info');
                            
                            // Request with high accuracy
                            navigator.geolocation.getCurrentPosition(
                                position => {
                                    const studentLat = position.coords.latitude;
                                    const studentLng = position.coords.longitude;
                                    
                                    // Check if session has location data
                                    if (!sessionData.location) {
                                        console.warn("Session has no location data, marking without location verification");
                                        db.collection('attendance').add({
                                            sessionId: sessionId,
                                            studentId: user.uid,
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
                                        studentId: user.uid,
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
                        } else {
                            markAttendanceWithoutLocation(sessionId, sessionData);
                        }
                    });
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
        studentId: user.uid,
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
                        // Will show browser permission dialog
                        resolve(true); 
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
    const Δλ = (lon1-lon2) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // Distance in meters
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
    // Check authentication
    firebase.auth().onAuthStateChanged(function(user) {
        if (!user) {
            window.location.href = 'index.html';
            return;
        }

        // Load user data
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