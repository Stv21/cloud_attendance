document.addEventListener('DOMContentLoaded', function() {
    // Request location permission when the page loads
    if (navigator.geolocation) {
        navigator.permissions.query({name:'geolocation'}).then(function(result) {
            if (result.state === 'granted') {
                document.getElementById('location-status').innerHTML = 
                    '<span class="status-good">✓ Location access granted</span>';
            } else if (result.state === 'prompt') {
                document.getElementById('location-status').innerHTML = 
                    '<span class="status-pending">ⓘ Location permission will be requested</span>';
            } else if (result.state === 'denied') {
                document.getElementById('location-status').innerHTML = 
                    '<span class="status-error">✗ Location access denied. Please enable in browser settings.</span>';
            }
        });
    }

    // Get class ID from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const classId = urlParams.get('classId');
    let selectedDate = urlParams.get('date') || new Date().toISOString().split('T')[0];
    
    if (!classId) {
        window.location.href = 'teacher.html';
        return;
    }
    
    // Set the date filter to the selected date
    document.getElementById('date-filter').value = selectedDate;
    
    // Initialize Chart.js
    let attendanceChart = null;
    
    // Load class info
    db.collection('classes').doc(classId).get()
        .then(doc => {
            if (doc.exists) {
                const classData = doc.data();
                document.getElementById('class-name').textContent = classData.name;
                loadAttendanceData(selectedDate);
            } else {
                console.error("Class not found");
                window.location.href = 'teacher.html';
            }
        })
        .catch(error => {
            console.error("Error loading class:", error);
        });
    
    // Date filter change event
    document.getElementById('date-filter').addEventListener('change', function() {
        selectedDate = this.value;
        loadAttendanceData(selectedDate);
    });
    
    function loadAttendanceData(dateStr) {
        const startDate = new Date(dateStr);
        startDate.setHours(0, 0, 0, 0);
        
        const endDate = new Date(dateStr);
        endDate.setHours(23, 59, 59, 999);
        
        // Query attendance records for this class on the selected date
        db.collection('attendance')
            .where('classId', '==', classId)
            .where('date', '>=', firebase.firestore.Timestamp.fromDate(startDate))
            .where('date', '<=', firebase.firestore.Timestamp.fromDate(endDate))
            .get()
            .then(snapshot => {
                // Process attendance data
                const attendanceRecords = [];
                let presentCount = 0;
                let totalCount = 0;
                
                snapshot.forEach(doc => {
                    const data = doc.data();
                    
                    attendanceRecords.push({
                        id: doc.id,
                        ...data,
                        formattedDate: data.date.toDate().toLocaleDateString(),
                        formattedTime: data.date.toDate().toLocaleTimeString()
                    });
                    
                    if (data.status === 'Present') {
                        presentCount++;
                    }
                    
                    totalCount++;
                });
                
                // Get all students in this class to count absent students
                db.collection('users')
                    .where('role', '==', ROLES.STUDENT)
                    .where('className', '==', document.getElementById('class-name').textContent)
                    .get()
                    .then(studentsSnapshot => {
                        const totalStudents = studentsSnapshot.size;
                        const absentCount = totalStudents - presentCount;
                        const attendanceRate = totalStudents > 0 ? (presentCount / totalStudents * 100).toFixed(2) : 0;
                        
                        // Update statistics
                        document.getElementById('present-count').textContent = presentCount;
                        document.getElementById('absent-count').textContent = absentCount;
                        document.getElementById('total-count').textContent = totalStudents;
                        document.getElementById('attendance-rate').textContent = `${attendanceRate}%`;
                        
                        // Fetch student details for each attendance record
                        const studentPromises = attendanceRecords.map(record => {
                            return db.collection('users').doc(record.studentId).get();
                        });
                        
                        Promise.all(studentPromises)
                            .then(studentDocs => {
                                // Map student data to attendance records
                                attendanceRecords.forEach((record, index) => {
                                    const studentDoc = studentDocs[index];
                                    if (studentDoc.exists) {
                                        const studentData = studentDoc.data();
                                        record.studentName = studentData.name;
                                        record.rollNo = studentData.rollNo || 'N/A';
                                    }
                                });
                                
                                // Display records in the table
                                displayAttendanceRecords(attendanceRecords);
                                
                                // Update chart
                                updateAttendanceChart(presentCount, absentCount);
                            });
                    });
            })
            .catch(error => {
                console.error("Error loading attendance data:", error);
                document.getElementById('attendance-records').innerHTML = 
                    `<tr><td colspan="6">Error loading attendance records: ${error.message}</td></tr>`;
            });
    }
    
    function displayAttendanceRecords(records) {
        const recordsTable = document.getElementById('attendance-records');
        
        if (records.length === 0) {
            recordsTable.innerHTML = '<tr><td colspan="6">No attendance records found for this date</td></tr>';
            return;
        }
        
        recordsTable.innerHTML = '';
        
        records.forEach(record => {
            const row = document.createElement('tr');
            
            row.innerHTML = `
                <td>${record.studentName || 'Unknown'}</td>
                <td>${record.rollNo}</td>
                <td><span class="${record.status === 'Present' ? 'attendance-success' : 'attendance-error'}">${record.status}</span></td>
                <td>${record.formattedDate}</td>
                <td>${record.formattedTime}</td>
                <td>${Math.round(record.distance || 0)}m</td>
            `;
            
            recordsTable.appendChild(row);
        });
    }
    
    function updateAttendanceChart(present, absent) {
        const ctx = document.getElementById('attendance-chart').getContext('2d');
        
        // Destroy existing chart if it exists
        if (attendanceChart) {
            attendanceChart.destroy();
        }
        
        // Create new chart
        attendanceChart = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: ['Present', 'Absent'],
                datasets: [{
                    data: [present, absent],
                    backgroundColor: ['#34A853', '#EA4335'],
                    borderColor: ['#2d8e47', '#d33426'],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    },
                    title: {
                        display: true,
                        text: `Attendance for ${document.getElementById('class-name').textContent} on ${document.getElementById('date-filter').value}`,
                        font: {
                            size: 16
                        }
                    }
                }
            }
        });
    }
    
    // Export attendance data
    window.exportAttendance = function(format) {
        const className = document.getElementById('class-name').textContent;
        const date = document.getElementById('date-filter').value;
        
        db.collection('attendance')
            .where('classId', '==', classId)
            .where('className', '==', className)
            .get()
            .then(snapshot => {
                if (snapshot.empty) {
                    alert('No attendance data to export');
                    return;
                }
                
                const records = [];
                snapshot.forEach(doc => {
                    const data = doc.data();
                    records.push({
                        studentId: data.studentId,
                        status: data.status,
                        date: data.date.toDate().toLocaleDateString(),
                        time: data.date.toDate().toLocaleTimeString(),
                        distance: Math.round(data.distance || 0) + 'm'
                    });
                });
                
                if (format === 'csv') {
                    exportCSV(records, `attendance_${className}_${date}.csv`);
                } else if (format === 'pdf') {
                    alert('PDF export would go here - requires additional library');
                    // Would need to include a PDF generation library like jsPDF
                }
            })
            .catch(error => {
                console.error('Error exporting attendance:', error);
                alert('Error exporting attendance data');
            });
    };
    
    function exportCSV(data, filename) {
        if (!data.length) return;
        
        // Get headers
        const headers = Object.keys(data[0]);
        
        // Create CSV content
        let csvContent = headers.join(',') + '\n';
        
        data.forEach(item => {
            const row = headers.map(header => {
                let cell = item[header] || '';
                // Escape quotes and wrap in quotes if contains comma
                cell = cell.toString().replace(/"/g, '""');
                if (cell.includes(',')) {
                    cell = `"${cell}"`;
                }
                return cell;
            });
            csvContent += row.join(',') + '\n';
        });
        
        // Create download link
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
});

// Add to your markAttendance function in attendance.js
function markAttendance(studentId) {
    document.getElementById('location-status').textContent = 'Checking your location...';
    
    if (!navigator.geolocation) {
        document.getElementById('location-status').textContent = 'Geolocation not supported by your browser';
        return;
    }
    
    const locationOptions = {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
    };
    
    navigator.geolocation.getCurrentPosition(
        // Success callback
        position => {
            const studentLat = position.coords.latitude;
            const studentLng = position.coords.longitude;
            const accuracy = position.coords.accuracy;
            
            // Show location details
            document.getElementById('location-details').style.display = 'block';
            
            // Update accuracy indicator (0-100%)
            const accuracyPercentage = Math.min(100, Math.max(0, 100 - (accuracy / 50 * 100)));
            document.getElementById('accuracy-bar').style.width = accuracyPercentage + '%';
            document.getElementById('accuracy-value').textContent = Math.round(accuracy) + ' meters';
            
            // Set color based on accuracy
            if (accuracyPercentage > 70) {
                document.getElementById('accuracy-bar').className = 'accuracy-bar good';
            } else if (accuracyPercentage > 40) {
                document.getElementById('accuracy-bar').className = 'accuracy-bar medium';
            } else {
                document.getElementById('accuracy-bar').className = 'accuracy-bar poor';
            }
            
            // Rest of your existing attendance marking code...
            
            // After calculating distance
            document.getElementById('distance-value').textContent = Math.round(distance) + ' meters';
        },
        // Error callback - enhanced with specific messages
        error => {
            let errorMessage = 'Error getting your location: ';
            switch(error.code) {
                case error.PERMISSION_DENIED:
                    errorMessage += 'Location permission denied. Please enable location in your browser settings.';
                    break;
                case error.POSITION_UNAVAILABLE:
                    errorMessage += 'Location information unavailable. Try moving to an area with better GPS signal.';
                    break;
                case error.TIMEOUT:
                    errorMessage += 'Location request timed out. Please try again.';
                    break;
                default:
                    errorMessage += error.message;
            }
            document.getElementById('location-status').innerHTML = 
                `<span class="status-error">${errorMessage}</span>`;
        },
        locationOptions
    );
}

// Add subject comparison chart to the initializeCharts function in teacher.js
function renderStreakIndicator(studentId, attendanceHistory) {
    // Get last 5 attendance records
    const streak = attendanceHistory
        .slice(0, 5)
        .map(record => record.status === 'Present' ? 'present' : 'absent');
    
    // Count consecutive present days
    let streakCount = 0;
    for (let i = 0; i < streak.length; i++) {
        if (streak[i] === 'present') streakCount++;
        else break;
    }
    
    // Create streak display html
    let streakDots = streak.map(s => `<span class="day ${s}"></span>`).join('');
    
    return `
        <div class="student-streak">
            <div class="streak-days">
                ${streakDots}
            </div>
            <span class="streak-count">${streakCount > 0 ? `${streakCount}-day streak` : 'No streak'}</span>
        </div>
    `;
}