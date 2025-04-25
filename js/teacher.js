// Global variables

let teacherLocation = null;

// Toast notifications function
function showToast(title, message, type = 'info') {
    // Try browser notifications first (much more visible)
    if ("Notification" in window) {
        // Check if permission is already granted
        if (Notification.permission === "granted") {
            createBrowserNotification(title, message, type);
        } 
        // Otherwise, ask for permission first
        else if (Notification.permission !== "denied") {
            Notification.requestPermission().then(function (permission) {
                if (permission === "granted") {
                    createBrowserNotification(title, message, type);
                } else {
                    // Fall back to alert dialog if notifications denied
                    showFallbackNotification(title, message, type);
                }
            });
        } else {
            // Notifications denied, use fallback
            showFallbackNotification(title, message, type);
        }
    } else {
        // Browser doesn't support notifications
        showFallbackNotification(title, message, type);
    }
}

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

// Generate a classroom code
function generateClassroomCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Create a new classroom
function createClassroom() {
    const createBtn = document.querySelector('[onclick="createClassroom()"]');
    if (!createBtn) {
        console.error("Create classroom button not found");
        return;
    }
    
    const originalText = createBtn.innerHTML;
    
    // Show loading state
    createBtn.classList.add('button-loading');
    createBtn.disabled = true;
    
    const name = document.getElementById('classroom-name').value.trim();
    const subject = document.getElementById('classroom-subject').value.trim();
    const section = document.getElementById('classroom-section').value.trim() || null;
    let code = document.getElementById('custom-code').value.trim();
    
    if (!name) {
        showToast('Error', 'Please enter a classroom name', 'error');
        createBtn.classList.remove('button-loading');
        createBtn.disabled = false;
        return;
    }
    
    if (!subject) {
        showToast('Error', 'Please enter a subject', 'error');
        createBtn.classList.remove('button-loading');
        createBtn.disabled = false;
        return;
    }
    
    // Generate a code if none provided
    if (!code) {
        code = generateClassroomCode();
    }
    
    const user = firebase.auth().currentUser;
    if (!user) {
        showToast('Error', 'You must be logged in to create a classroom', 'error');
        createBtn.classList.remove('button-loading');
        createBtn.disabled = false;
        return;
    }
    
    // Create classroom with error handling
    db.collection('classrooms').add({
        name: name,
        subject: subject,
        section: section,
        teacherId: user.uid,
        teacherName: user.displayName || 'Teacher',
        joinCode: code,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        active: true,
        studentCount: 0
    })
    .then((docRef) => {
        // Show success toast
        showToast('Classroom Created', `Class "${name}" was created successfully. Join code: ${code}`, 'success');
        
        // Clear form
        document.getElementById('classroom-name').value = '';
        document.getElementById('classroom-subject').value = '';
        document.getElementById('classroom-section').value = '';
        document.getElementById('custom-code').value = '';
        
        // Add the new classroom to UI immediately without reloading
        addClassroomToUI({
            id: docRef.id,
            name: name,
            subject: subject,
            section: section,
            joinCode: code,
            studentCount: 0
        });
        
        // Update stats
        loadTeacherStats();
    })
    .catch(error => {
        console.error("Error creating classroom:", error);
        showToast('Error', 'Failed to create classroom. Please try again.', 'error');
    })
    .finally(() => {
        // Remove loading state
        createBtn.classList.remove('button-loading');
        createBtn.disabled = false;
        createBtn.innerHTML = originalText;
    });
}

// Add a single classroom to the UI
function addClassroomToUI(classroom) {
    const classroomsList = document.getElementById('classrooms-list');
    if (!classroomsList) {
        console.error("Classrooms list element not found");
        return;
    }
    
    // If there's a "no classrooms" message, clear it
    if (classroomsList.querySelector('p')) {
        classroomsList.innerHTML = '';
    }
    
    const classroomCard = document.createElement('div');
    classroomCard.className = 'classroom-card mb-3';
    classroomCard.id = `classroom-${classroom.id}`;
    
    classroomCard.innerHTML = `
        <div class="card">
            <div class="card-header">
                <h4>${classroom.name || 'Untitled Class'}</h4>
                <span class="badge badge-primary">${classroom.subject || 'No Subject'}</span>
            </div>
            <div class="card-body">
                <div class="classroom-details">
                    ${classroom.section ? `<p><strong>Section:</strong> ${classroom.section}</p>` : ''}
                    <p><strong>Join Code:</strong> <span class="classroom-code">${classroom.joinCode || 'N/A'}</span></p>
                    <p><strong>Students:</strong> ${classroom.studentCount || 0}</p>
                </div>
                <div class="classroom-actions mt-3">
                    <button class="btn btn-sm btn-primary" onclick="viewClassroom('${classroom.id}')">View Details</button>
                    <button class="btn btn-sm btn-success" onclick="toggleAttendanceSession('${classroom.id}', this)">Take Attendance</button>
                    <button class="btn btn-sm btn-secondary" onclick="copyJoinCode('${classroom.joinCode || ''}')">Copy Code</button>
                </div>
            </div>
        </div>
    `;
    
    // Add to the beginning of the list
    classroomsList.insertBefore(classroomCard, classroomsList.firstChild);
}

// Load teacher's classrooms
function loadClassrooms() {
    console.log("Loading classrooms...");
    const user = firebase.auth().currentUser;
    if (!user) {
        console.error("No authenticated user when loading classrooms");
        return;
    }
    
    const classroomsList = document.getElementById('classrooms-list');
    if (!classroomsList) {
        console.error("Classrooms list element not found");
        return;
    }
    
    classroomsList.innerHTML = '<p>Loading classrooms...</p>';
    
    // Query for all classrooms created by this teacher
    db.collection('classrooms')
        .where('teacherId', '==', user.uid)
        .get()
        .then(snapshot => {
            console.log(`Found ${snapshot.size} classrooms`);
            
            if (snapshot.empty) {
                classroomsList.innerHTML = '<p>You haven\'t created any classrooms yet.</p>';
                return;
            }
            
            // Clear the list
            classroomsList.innerHTML = '';
            
            // Process each classroom document
            snapshot.forEach(doc => {
                try {
                    const classroom = {
                        id: doc.id,
                        ...doc.data()
                    };
                    
                    // Create classroom card
                    const classroomCard = document.createElement('div');
                    classroomCard.className = 'classroom-card mb-3';
                    
                    classroomCard.innerHTML = `
                        <div class="card">
                            <div class="card-header">
                                <h4>${classroom.name || 'Untitled Class'}</h4>
                                <span class="badge badge-primary">${classroom.subject || 'No Subject'}</span>
                            </div>
                            <div class="card-body">
                                <div class="classroom-details">
                                    ${classroom.section ? `<p><strong>Section:</strong> ${classroom.section}</p>` : ''}
                                    <p><strong>Join Code:</strong> <span class="classroom-code">${classroom.joinCode || 'N/A'}</span></p>
                                    <p><strong>Students:</strong> ${classroom.studentCount || 0}</p>
                                </div>
                                <div class="classroom-actions mt-3">
                                    <button class="btn btn-sm btn-primary" onclick="viewClassroom('${classroom.id}')">View Details</button>
                                    <button class="btn btn-sm btn-success" onclick="toggleAttendanceSession('${classroom.id}', this)">Take Attendance</button>
                                    <button class="btn btn-sm btn-secondary" onclick="copyJoinCode('${classroom.joinCode || ''}')">Copy Code</button>
                                </div>
                            </div>
                        </div>
                    `;
                    
                    classroomsList.appendChild(classroomCard);
                } catch (error) {
                    console.error("Error rendering classroom:", error);
                }
            });
        })
        .catch(error => {
            console.error("Error loading classrooms:", error);
            classroomsList.innerHTML = `<p>Error loading classrooms: ${error.message}. Please try again later.</p>`;
        });
}

// Copy join code to clipboard
function copyJoinCode(code) {
    navigator.clipboard.writeText(code)
        .then(() => {
            showToast('Success', 'Join code copied to clipboard!', 'success');
        })
        .catch(err => {
            console.error('Could not copy text: ', err);
            // Fallback
            const el = document.createElement('textarea');
            el.value = code;
            document.body.appendChild(el);
            el.select();
            document.execCommand('copy');
            document.body.removeChild(el);
            showToast('Success', 'Join code copied to clipboard!', 'success');
        });
}

// View classroom details
function viewClassroom(classroomId) {
    window.location.href = `classroom.html?id=${classroomId}`;
}

// Helper function to prompt for location
function promptForLocation() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error("Geolocation is not supported by this browser"));
            return;
        }
        
        navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        });
    });
}

// Replace the startClassAttendance function with this simplified version
function startClassAttendance(classroomId) {
    return new Promise((resolve, reject) => {
        // Show loading state
        const btn = event.target;
        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Starting...';
    
        // Show popup about location request (demo purposes only)
        showToast('Location Request', 'We\'ll ask for your location for demo purposes.', 'info');
    
        // Get classroom details
        db.collection('classrooms').doc(classroomId).get()
            .then(doc => {
                if (!doc.exists) {
                    showToast('Error', 'Classroom not found', 'error');
                    btn.disabled = false;
                    btn.innerHTML = originalText;
                    return reject("Classroom not found");
                }
                const classroom = doc.data();
    
                // Request location (for demo only; ignore result)
                if (navigator.geolocation) {
                    navigator.geolocation.getCurrentPosition(
                        position => { console.log("Location granted:", position.coords); },
                        error => { console.log("Location error (demo continue):", error.message); }
                    );
                }
    
                // Create new attendance session (demo mode)
                db.collection('attendanceSessions').add({
                    classroomId: classroomId,
                    classroomName: classroom.name,
                    teacherId: firebase.auth().currentUser.uid,
                    teacherName: firebase.auth().currentUser.displayName || 'Teacher',
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    active: true,
                    demoMode: true,
                    // Use a placeholder location since we're not verifying
                    location: new firebase.firestore.GeoPoint(0, 0),
                    radius: 999999, // virtually any location qualifies
                    code: Math.floor(100000 + Math.random() * 900000).toString() // 6-digit code
                })
                .then(sessionRef => {
                    // Update UI: show active session indicator and change button text
                    document.getElementById('current-classroom-indicator').style.display = 'block';
                    document.getElementById('active-classroom-name').textContent = classroom.name;
                    
                    btn.disabled = false;
                    btn.innerHTML = 'Stop Session';
                    btn.className = 'btn btn-sm btn-danger';
    
                    showToast('Session Started', `Attendance session started for ${classroom.name}`, 'success');
                    
                    // Start 15-minute timer
                    startSessionTimer(sessionRef.id, 15 * 60);
    
                    // Return new session id for toggling later
                    resolve(sessionRef.id);
                })
                .catch(error => {
                    console.error("Error starting session:", error);
                    showToast('Error', 'Failed to start attendance session', 'error');
                    btn.disabled = false;
                    btn.innerHTML = originalText;
                    reject(error);
                });
            })
            .catch(error => {
                console.error("Error getting classroom:", error);
                showToast('Error', 'Failed to get classroom details', 'error');
                btn.disabled = false;
                btn.innerHTML = originalText;
                reject(error);
            });
    });
}

// Function to start a session timer for a given duration (in seconds)
function startSessionTimer(sessionId, duration) {
    const timerElement = document.getElementById('session-timer');
    if (timerElement) {
        timerElement.style.display = 'block';
    }
    const intervalId = setInterval(() => {
        if (duration <= 0) {
            clearInterval(intervalId);
            if (timerElement) timerElement.textContent = "Session expired";
            // Optionally, auto-stop the session here
            return;
        }
        const minutes = Math.floor(duration / 60);
        const seconds = duration % 60;
        if (timerElement) {
            timerElement.textContent = `Time remaining: ${minutes}:${seconds < 10 ? '0' + seconds : seconds}`;
        }
        duration--;
    }, 1000);
    // Optionally, store intervalId if you want to stop the timer when the session stops.
}

// Function to stop an attendance session
function stopClassAttendance(sessionId, btn, originalText) {
    db.collection('attendanceSessions').doc(sessionId).update({ active: false })
        .then(() => {
            showToast('Session Stopped', 'Attendance session has been stopped.', 'success');
            btn.innerHTML = originalText; // e.g., "Start Session"
            btn.disabled = false;
            btn.className = 'btn btn-sm btn-primary';
            
            // Optionally, hide the session timer
            const timerElement = document.getElementById('session-timer');
            if (timerElement) {
                timerElement.style.display = 'none';
            }
        })
        .catch(error => {
            showToast('Error', 'Failed to stop the session: ' + error.message, 'error');
        });
}

// Add this function to fix the stats display
function loadTeacherStats() {
    const user = firebase.auth().currentUser;
    if (!user) return;
    
    // Get classroom count
    db.collection('classrooms')
        .where('teacherId', '==', user.uid)
        .get()
        .then(classroomsSnapshot => {
            const classroomsCount = classroomsSnapshot.size;
            document.getElementById('total-classes').textContent = classroomsCount;
            
            // Get all classroomIds created by this teacher
            const classroomIds = classroomsSnapshot.docs.map(doc => doc.id);
            
            // If teacher has no classrooms yet
            if (classroomIds.length === 0) {
                document.getElementById('total-students').textContent = '0';
                return;
            }
            
            // Count unique students across all classes
            if (classroomIds.length > 10) {
                // If too many classrooms, just use the count from classroom documents
                let totalStudents = 0;
                classroomsSnapshot.forEach(doc => {
                    totalStudents += doc.data().studentCount || 0;
                });
                document.getElementById('total-students').textContent = totalStudents;
                return;
            }
            
            // Otherwise, get accurate unique student count
            db.collection('classroomMembers')
                .where('classroomId', 'in', classroomIds)
                .get()
                .then(membersSnapshot => {
                    // Use a Set to track unique students
                    const uniqueStudents = new Set();
                    
                    membersSnapshot.forEach(doc => {
                        const member = doc.data();
                        uniqueStudents.add(member.studentId);
                    });
                    
                    document.getElementById('total-students').textContent = uniqueStudents.size;
                })
                .catch(error => {
                    console.error("Error counting students:", error);
                });
        })
        .catch(error => {
            console.error("Error counting classrooms:", error);
        });
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    console.log("Teacher dashboard initializing...");
    
    // Check authentication
    firebase.auth().onAuthStateChanged(user => {
        if (!user) {
            console.log("No authenticated user, redirecting to login");
            window.location.href = 'index.html';
            return;
        }
        
        console.log("User authenticated:", user.uid);
        
        // Get additional user data from Firestore
        db.collection('users').doc(user.uid).get()
            .then(doc => {
                if (doc.exists) {
                    const userData = doc.data();
                    console.log("User data loaded:", userData.name);
                    
                    // Display user info
                    document.getElementById('teacher-name').textContent = userData.name || 'Teacher';
                    document.getElementById('teacher-email').textContent = userData.email || user.email || '';
                    document.getElementById('teacher-display-name').textContent = userData.name || 'Teacher';
                    
                    // Initialize user avatar
                    const name = userData.name || 'T';
                    const initials = name.charAt(0);
                    document.getElementById('user-avatar').src = `https://ui-avatars.com/api/?name=${initials}&background=34a853&color=fff`;
                } else {
                    console.log("No user document found, using auth data");
                    document.getElementById('teacher-name').textContent = user.displayName || 'Teacher';
                    document.getElementById('teacher-email').textContent = user.email || '';
                    document.getElementById('teacher-display-name').textContent = user.displayName || 'Teacher';
                    
                    // Initialize user avatar
                    const name = user.displayName || 'T';
                    const initials = name.charAt(0);
                    document.getElementById('user-avatar').src = `https://ui-avatars.com/api/?name=${initials}&background=34a853&color=fff`;
                }
            })
            .catch(error => {
                console.error("Error getting user document:", error);
            });
        
        // Load teacher's classrooms
        loadClassrooms();
        
        // Load teacher stats
        loadTeacherStats();
    });
    
    // Mobile menu toggle
    const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
    if (mobileMenuToggle) {
        mobileMenuToggle.addEventListener('click', function() {
            document.querySelector('.sidebar').classList.toggle('active');
        });
    }
});

// Add to your teacher.js and dashboard.js files
document.addEventListener('DOMContentLoaded', function() {
    // Create mobile menu toggle if it doesn't exist
    if (!document.querySelector('.mobile-menu-toggle')) {
        const toggle = document.createElement('button');
        toggle.className = 'mobile-menu-toggle';
        toggle.innerHTML = '<i class="fas fa-bars"></i>';
        document.body.appendChild(toggle);
        
        // Add click event
        toggle.addEventListener('click', function() {
            const sidebar = document.querySelector('.sidebar');
            sidebar.classList.toggle('active');
        });
    }
});

// This function toggles between starting a new session and stopping the active session.
function toggleAttendanceSession(classroomId, btn) {
    // Check if button already indicates an active session by a data attribute
    if (btn.dataset.sessionActive === "true") {
        // Stop the current session.
        stopClassAttendance(btn.dataset.sessionId, btn, "Take Attendance");
        // Clear the data attributes so the teacher can start a new session next time.
        btn.dataset.sessionActive = "false";
        btn.dataset.sessionId = "";
    } else {
        // Start a new session.
        startClassAttendance(classroomId)
            .then(newSessionId => {
                // Change the button to Stop Session
                btn.dataset.sessionActive = "true";
                btn.dataset.sessionId = newSessionId; // Store new session id for later stopping
            })
            .catch(error => {
                console.error("Failed to start session:", error);
            });
    }
}