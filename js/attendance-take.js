document.addEventListener('DOMContentLoaded', function() {
    // Get class ID and date from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const classId = urlParams.get('classId');
    const dateParam = urlParams.get('date');
    
    if (!classId) {
        window.location.href = 'teacher.html';
        return;
    }
    
    let sessionActive = false;
    let sessionCode = '';
    let sessionTimer = null;
    let sessionStartTime = null;
    let sessionDuration = 30; // Default: 30 minutes
    let teacherLocation = null;
    
    // Load class info
    db.collection('classes').doc(classId).get()
        .then(doc => {
            if (doc.exists) {
                const classData = doc.data();
                document.getElementById('class-name').textContent = classData.name;
            } else {
                console.error("Class not found");
                window.location.href = 'teacher.html';
            }
        })
        .catch(error => {
            console.error("Error loading class:", error);
        });
    
    // Set up session duration dropdown
    document.getElementById('session-duration').addEventListener('change', function() {
        sessionDuration = parseInt(this.value);
    });
    
    // Set up start session button
    document.getElementById('start-session-btn').addEventListener('click', startSession);
    
    // Set up end session button
    document.getElementById('end-session-btn').addEventListener('click', endSession);
    
    // Get teacher's location
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            position => {
                teacherLocation = {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude
                };
                
                document.getElementById('location-status').textContent = 
                    `Location acquired: ${teacherLocation.latitude.toFixed(6)}, ${teacherLocation.longitude.toFixed(6)}`;
            },
            error => {
                let errorMessage = "Error getting location: ";
                switch(error.code) {
                    case error.PERMISSION_DENIED:
                        errorMessage += "Location permission denied";
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMessage += "Location unavailable";
                        break;
                    case error.TIMEOUT:
                        errorMessage += "Location request timed out";
                        break;
                    default:
                        errorMessage += "Unknown error";
                }
                document.getElementById('location-status').textContent = errorMessage;
            }
        );
    } else {
        document.getElementById('location-status').textContent = "Geolocation not supported in this browser";
    }
    
    function startSession() {
        if (!teacherLocation) {
            alert("Cannot start session without location data. Please allow location access.");
            return;
        }
        
        // Generate a random 6-digit code
        sessionCode = Math.floor(100000 + Math.random() * 900000).toString();
        document.getElementById('class-code').textContent = sessionCode;
        
        // Update class document with attendance session info
        db.collection('classes').doc(classId).update({
            activeAttendanceSession: true,
            sessionCode: sessionCode,
            sessionStartTime: firebase.firestore.FieldValue.serverTimestamp(),
            sessionDuration: sessionDuration,
            location: teacherLocation
        })
        .then(() => {
            sessionActive = true;
            sessionStartTime = new Date();
            
            // Update UI
            document.getElementById('start-session-btn').style.display = 'none';
            document.getElementById('end-session-btn').style.display = 'inline-block';
            document.getElementById('session-duration').disabled = true;
            
            // Start timer
            updateTimer();
            sessionTimer = setInterval(updateTimer, 1000);
            
            // Start listening for attendance records
            listenForAttendance();
        })
        .catch(error => {
            console.error("Error starting session:", error);
            alert("Error starting attendance session");
        });
    }
    
    function endSession() {
        if (!sessionActive) return;
        
        // Update class document to end attendance session
        db.collection('classes').doc(classId).update({
            activeAttendanceSession: false,
            sessionCode: null
        })
        .then(() => {
            sessionActive = false;
            clearInterval(sessionTimer);
            
            // Update UI
            document.getElementById('start-session-btn').style.display = 'inline-block';
            document.getElementById('end-session-btn').style.display = 'none';
            document.getElementById('session-duration').disabled = false;
            document.getElementById('session-timer').textContent = "Session ended";
            
            // Notify user
            alert("Attendance session ended successfully");
            
            // Redirect to attendance view
            window.location.href = `attendance-view.html?classId=${classId}&date=${dateParam}`;
        })
        .catch(error => {
            console.error("Error ending session:", error);
            alert("Error ending attendance session");
        });
    }
    
    function updateTimer() {
        if (!sessionActive || !sessionStartTime) return;
        
        const now = new Date();
        const elapsedMinutes = Math.floor((now - sessionStartTime) / 60000);
        const elapsedSeconds = Math.floor(((now - sessionStartTime) % 60000) / 1000);
        
        const remainingMinutes = sessionDuration - elapsedMinutes - 1;
        const remainingSeconds = 60 - elapsedSeconds;
        
        if (remainingMinutes < 0) {
            // Session time is up, automatically end it
            endSession();
            return;
        }
        
        document.getElementById('session-timer').textContent = 
            `Time remaining: ${remainingMinutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
    }
    
    function listenForAttendance() {
        // Get student list for this class
        db.collection('users')
            .where('role', '==', ROLES.STUDENT)
            .where('className', '==', document.getElementById('class-name').textContent)
            .get()
            .then(snapshot => {
                const studentTable = document.getElementById('student-list-table');
                
                // Create table header if it doesn't exist
                if (!studentTable.querySelector('thead')) {
                    studentTable.innerHTML = `
                        <thead>
                            <tr>
                                <th>Roll No</th>
                                <th>Student Name</th>
                                <th>Status</th>
                                <th>Time</th>
                                <th>Distance</th>
                            </tr>
                        </thead>
                        <tbody id="student-list"></tbody>
                    `;
                }
                
                const studentListBody = document.getElementById('student-list');
                studentListBody.innerHTML = '';
                
                // Add each student to the table
                snapshot.forEach(doc => {
                    const student = doc.data();
                    const row = document.createElement('tr');
                    row.id = `student-${doc.id}`;
                    
                    row.innerHTML = `
                        <td>${student.rollNo || 'N/A'}</td>
                        <td>${student.name}</td>
                        <td class="status">Absent</td>
                        <td class="time">-</td>
                        <td class="distance">-</td>
                    `;
                    
                    studentListBody.appendChild(row);
                });
                
                // Listen for real-time attendance updates
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                
                db.collection('attendance')
                    .where('classId', '==', classId)
                    .where('date', '>=', today)
                    .onSnapshot(snapshot => {
                        snapshot.docChanges().forEach(change => {
                            if (change.type === 'added' || change.type === 'modified') {
                                const attendanceData = change.doc.data();
                                const studentRow = document.getElementById(`student-${attendanceData.studentId}`);
                                
                                if (studentRow) {
                                    const statusCell = studentRow.querySelector('.status');
                                    const timeCell = studentRow.querySelector('.time');
                                    const distanceCell = studentRow.querySelector('.distance');
                                    
                                    statusCell.textContent = attendanceData.status;
                                    statusCell.style.color = attendanceData.status === 'Present' ? '#34A853' : '#EA4335';
                                    
                                    timeCell.textContent = new Date(attendanceData.date.toDate()).toLocaleTimeString();
                                    distanceCell.textContent = `${Math.round(attendanceData.distance || 0)}m`;
                                }
                            }
                        });
                    });
            })
            .catch(error => {
                console.error("Error loading students:", error);
            });
    }
});