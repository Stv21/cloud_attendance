document.addEventListener('DOMContentLoaded', function() {
    // Check authentication
    firebase.auth().onAuthStateChanged(function(user) {
        if (!user) {
            window.location.href = 'index.html';
            return;
        }
        
        const studentId = user.uid;
        loadStudentInfo(studentId);
        loadAttendanceHistory(studentId);
        
        // Setup attendance marking
        document.getElementById('mark-attendance-btn').addEventListener('click', () => {
            markAttendance(studentId);
        });
        
        loadAvailableSessions();
        
        // Refresh available sessions every minute
        setInterval(loadAvailableSessions, 60000);
    });
    
    // Check for saved sessions
    const savedSessions = localStorage.getItem('activeClassSessions');
    if (savedSessions) {
        activeClassSessions = JSON.parse(savedSessions);
        
        // Clean expired sessions
        const now = new Date().getTime();
        Object.keys(activeClassSessions).forEach(classId => {
            if (activeClassSessions[classId].expiresAt < now) {
                delete activeClassSessions[classId];
            } else {
                // Show active session UI
                document.getElementById('active-session-code').textContent = activeClassSessions[classId].code;
                document.getElementById('continuous-mode').style.display = 'block';
            }
        });
        
        localStorage.setItem('activeClassSessions', JSON.stringify(activeClassSessions));
    }
});

// Load student information
function loadStudentInfo(studentId) {
    db.collection('users').doc(studentId).get()
        .then(doc => {
            if (doc.exists) {
                const student = doc.data();
                document.getElementById('student-name').textContent = student.name;
                document.getElementById('student-id').textContent = student.rollNo || 'N/A';
                document.getElementById('student-class').textContent = student.className || 'N/A';
            } else {
                console.error("No student document found");
            }
        }).catch(error => {
            console.error("Error getting student document:", error);
        });
}

// Load attendance history
function loadAttendanceHistory(studentId) {
    db.collection('attendance')
        .where('studentId', '==', studentId)
        .orderBy('date', 'desc')
        .limit(10)
        .get()
        .then(snapshot => {
            const historyTable = document.getElementById('attendance-history');
            historyTable.innerHTML = '';
            
            if (snapshot.empty) {
                historyTable.innerHTML = '<tr><td colspan="4">No attendance records found.</td></tr>';
                return;
            }
            
            snapshot.forEach(doc => {
                const data = doc.data();
                const row = document.createElement('tr');
                
                // Convert Firestore Timestamp to JS Date
                const date = data.date.toDate();
                const formattedDate = date.toLocaleDateString();
                const formattedTime = date.toLocaleTimeString();
                
                row.innerHTML = `
                    <td>${formattedDate}</td>
                    <td>${formattedTime}</td>
                    <td>${data.className || 'N/A'}</td>
                    <td><span class="${data.status === 'Present' ? 'attendance-success' : 'attendance-error'}">${data.status}</span></td>
                `;
                
                historyTable.appendChild(row);
            });
        })
        .catch(error => {
            console.error("Error getting attendance history:", error);
        });
}

// Mark attendance with geolocation
let activeClassSessions = {};

function markAttendance(studentId) {
    const locationStatus = document.getElementById('location-status');
    locationStatus.textContent = 'Checking your location...';
    
    if (!navigator.geolocation) {
        locationStatus.textContent = 'Geolocation is not supported by your browser';
        return;
    }
    
    navigator.geolocation.getCurrentPosition(
        // Success callback
        position => {
            const latitude = position.coords.latitude;
            const longitude = position.coords.longitude;
            
            locationStatus.textContent = 'Location verified, processing attendance...';
            
            // Get the class code from input
            const classCode = document.getElementById('class-code').value;
            if (!classCode) {
                alert('Please enter a class code');
                locationStatus.textContent = 'Location verified. Enter a class code to continue.';
                return;
            }
            
            // Verify class code and location
            db.collection('classes')
                .where('sessionCode', '==', classCode)
                .where('activeAttendanceSession', '==', true)
                .get()
                .then(snapshot => {
                    if (snapshot.empty) {
                        alert('Invalid or expired class code');
                        locationStatus.textContent = 'Invalid class code. Please try again.';
                        return;
                    }
                    
                    const classDoc = snapshot.docs[0];
                    const classData = classDoc.data();
                    
                    // Calculate distance from class location
                    const classLat = classData.location.latitude;
                    const classLng = classData.location.longitude;
                    const distance = calculateDistance(latitude, longitude, classLat, classLng);
                    
                    // If within radius, mark as present (default 500m from SCHOOL_LOCATION)
                    const status = distance <= SCHOOL_LOCATION.radius ? 'Present' : 'Outside Range';
                    
                    // Check if already marked attendance for this session
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    
                    db.collection('attendance')
                        .where('studentId', '==', studentId)
                        .where('classId', '==', classDoc.id)
                        .where('date', '>=', today)
                        .get()
                        .then(existingAttendance => {
                            if (!existingAttendance.empty) {
                                alert('You have already marked attendance for this class today');
                                locationStatus.textContent = 'Attendance already marked for this class today.';
                                return;
                            }
                            
                            // Record attendance
                            db.collection('attendance').add({
                                studentId: studentId,
                                classId: classDoc.id,
                                className: classData.name,
                                date: firebase.firestore.Timestamp.now(),
                                status: status,
                                location: {
                                    latitude: latitude,
                                    longitude: longitude
                                },
                                distance: distance
                            })
                            .then(() => {
                                if (status === 'Present') {
                                    showSuccess('Attendance marked successfully!');
                                    
                                    // Call Azure Function for logging attendance
                                    logAttendanceToAzure(studentId, classDoc.id, status);
                                    
                                } else {
                                    showError(`You're ${Math.round(distance)}m away from class. Attendance marked as "${status}".`);
                                }
                                
                                loadAttendanceHistory(studentId);
                                document.getElementById('class-code').value = '';
                                
                                // Store active session info in localStorage
                                activeClassSessions[classDoc.id] = {
                                    code: classCode,
                                    expiresAt: new Date().getTime() + (sessionDuration * 60 * 1000)
                                };
                                localStorage.setItem('activeClassSessions', JSON.stringify(activeClassSessions));
                                
                                // Show option for continuous attendance
                                document.getElementById('continuous-mode').style.display = 'block';
                            })
                            .catch(error => {
                                console.error("Error adding attendance:", error);
                                locationStatus.textContent = 'Error recording attendance. Please try again.';
                            });
                        });
                })
                .catch(error => {
                    console.error("Error verifying class code:", error);
                    locationStatus.textContent = 'Error verifying class code.';
                });
        },
        // Error callback
        error => {
            switch(error.code) {
                case error.PERMISSION_DENIED:
                    locationStatus.textContent = 'User denied the request for geolocation';
                    break;
                case error.POSITION_UNAVAILABLE:
                    locationStatus.textContent = 'Location information is unavailable';
                    break;
                case error.TIMEOUT:
                    locationStatus.textContent = 'The request to get user location timed out';
                    break;
                default:
                    locationStatus.textContent = 'An unknown error occurred';
                    break;
            }
        }
    );
}

// Calculate distance between two points using Haversine formula
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth radius in meters
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // Distance in meters
}

// Log attendance to Azure Function
function logAttendanceToAzure(studentId, classId, status) {
    fetch(AZURE_FUNCTION_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            userId: studentId,
            classId: classId,
            status: status,
            timestamp: new Date().toISOString()
        })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return response.json();
    })
    .then(data => {
        console.log('Attendance logged to Azure:', data);
    })
    .catch(error => {
        console.error('Error logging to Azure:', error);
        // Still mark as success since Firebase recording succeeded
    });
}

// Show success message
function showSuccess(message) {
    const container = document.getElementById('attendance-result');
    container.className = 'attendance-success';
    container.innerHTML = message;
    container.style.display = 'block';
    
    setTimeout(() => {
        container.style.display = 'none';
    }, 5000);
}

// Show error message
function showError(message) {
    const container = document.getElementById('attendance-result');
    container.className = 'attendance-error';
    container.innerHTML = message;
    container.style.display = 'block';
    
    setTimeout(() => {
        container.style.display = 'none';
    }, 5000);
}

// Load active attendance sessions for student's classes
function loadAvailableSessions() {
    const user = firebase.auth().currentUser;
    if (!user) return;
    
    const sessionsListElement = document.getElementById('available-sessions-list');
    
    // First get student's classes
    db.collection('users').doc(user.uid).get()
        .then(doc => {
            if (doc.exists) {
                const userData = doc.data();
                
                // Find active sessions
                db.collection('attendanceSessions')
                    .where('active', '==', true)
                    .get()
                    .then(snapshot => {
                        if (snapshot.empty) {
                            sessionsListElement.innerHTML = '<p>No active sessions available</p>';
                            return;
                        }
                        
                        sessionsListElement.innerHTML = '';
                        
                        snapshot.forEach(doc => {
                            const session = doc.data();
                            const expiresAt = session.expiresAt.toDate();
                            const now = new Date();
                            const minutesRemaining = Math.floor((expiresAt - now) / 60000);
                            
                            // Skip if expired
                            if (minutesRemaining <= 0) return;
                            
                            const sessionElement = document.createElement('div');
                            sessionElement.className = 'available-session';
                            sessionElement.innerHTML = `
                                <h4>${session.className}</h4>
                                <p><strong>Time remaining:</strong> ${minutesRemaining} minutes</p>
                                <button class="btn btn-sm btn-primary" onclick="joinSession('${session.sessionCode}')">Join Session</button>
                            `;
                            sessionsListElement.appendChild(sessionElement);
                        });
                        
                        if (sessionsListElement.innerHTML === '') {
                            sessionsListElement.innerHTML = '<p>No active sessions available</p>';
                        }
                    });
            }
        })
        .catch(error => {
            console.error("Error loading user data:", error);
        });
}

// Join a session by code
function joinSession(code) {
    document.getElementById('class-code').value = code;
    document.getElementById('mark-attendance-btn').click();
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    firebase.auth().onAuthStateChanged(user => {
        if (user) {
            loadAvailableSessions();
            
            // Refresh available sessions every minute
            setInterval(loadAvailableSessions, 60000);
        } else {
            window.location.href = 'index.html';
        }
    });
});