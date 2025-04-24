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
                    <button class="btn btn-sm btn-success" onclick="startClassAttendance('${classroom.id}')">Take Attendance</button>
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
                                    <button class="btn btn-sm btn-success" onclick="startClassAttendance('${classroom.id}')">Take Attendance</button>
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

// Start attendance for a classroom with location prompt
function startClassAttendance(classroomId) {
    // Show loading state
    const btn = event.target;
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Starting...';
    
    // First request location automatically
    promptForLocation().then(location => {
        // Location access granted
        const { latitude, longitude } = location.coords;
        teacherLocation = { latitude, longitude };
        
        // Get classroom details
        db.collection('classrooms').doc(classroomId).get()
            .then(doc => {
                if (!doc.exists) {
                    showToast('Error', 'Classroom not found', 'error');
                    btn.disabled = false;
                    btn.innerHTML = originalText;
                    return;
                }
                
                const classroom = doc.data();
                
                // Create attendance session
                db.collection('attendanceSessions').add({
                    classroomId: classroomId,
                    classroomName: classroom.name,
                    teacherId: firebase.auth().currentUser.uid,
                    teacherName: firebase.auth().currentUser.displayName || 'Teacher',
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    active: true,
                    location: new firebase.firestore.GeoPoint(
                        latitude, 
                        longitude
                    ),
                    radius: 100, // meters
                    code: Math.floor(100000 + Math.random() * 900000).toString() // 6-digit code
                })
                .then(sessionRef => {
                    // Show current classroom indicator
                    document.getElementById('current-classroom-indicator').style.display = 'block';
                    document.getElementById('active-classroom-name').textContent = classroom.name;
                    
                    // Update button
                    btn.disabled = false;
                    btn.innerHTML = 'Session Active';
                    btn.className = 'btn btn-sm btn-warning';
                    
                    // Show success toast
                    showToast('Success', `Attendance session started for ${classroom.name}`, 'success');
                    
                    // Redirect to attendance view page
                    window.location.href = `attendance-view.html?session=${sessionRef.id}&classroom=${classroomId}`;
                })
                .catch(error => {
                    console.error("Error starting attendance session:", error);
                    showToast('Error', 'Failed to start attendance session', 'error');
                    btn.disabled = false;
                    btn.innerHTML = originalText;
                });
            })
            .catch(error => {
                console.error("Error getting classroom:", error);
                showToast('Error', 'Failed to get classroom details', 'error');
                btn.disabled = false;
                btn.innerHTML = originalText;
            });
    }).catch(error => {
        // Location access denied or error
        console.error("Location error:", error);
        showToast('Error', 'Location access is required to start attendance', 'error');
        btn.disabled = false;
        btn.innerHTML = originalText;
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