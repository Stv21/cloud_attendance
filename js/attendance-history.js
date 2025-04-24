// Attendance History JavaScript

let userData = null;
let attendanceData = [];
let attendanceBySubject = {};
let allSubjects = [];

// Initialize Firebase and auth listeners
document.addEventListener('DOMContentLoaded', function() {
    // Initialize Firebase (assuming firebase-config.js is already loaded)
    firebase.auth().onAuthStateChanged(user => {
        if (user) {
            loadUserData(user);
            loadAttendanceData(user.uid);
        } else {
            // Not logged in, redirect to login
            window.location.href = 'index.html';
        }
    });
});

// Load user profile data
function loadUserData(user) {
    const db = firebase.firestore();
    
    db.collection('users').doc(user.uid).get()
        .then(doc => {
            if (doc.exists) {
                userData = doc.data();
                updateUserInfo(userData);
            } else {
                console.error("No user data found");
            }
        })
        .catch(error => {
            console.error("Error loading user data:", error);
        });
}

// Update UI with user information
function updateUserInfo(userData) {
    // Update sidebar user info
    document.getElementById('user-name').textContent = userData.name || 'Student';
    document.getElementById('user-email').textContent = userData.email || '';
    
    // Set avatar with first letter of name
    const initials = userData.name ? userData.name.charAt(0) : 'S';
    document.getElementById('user-avatar').src = `https://ui-avatars.com/api/?name=${initials}&background=random`;
}

// Load attendance records for the current user
function loadAttendanceData(userId) {
    const db = firebase.firestore();
    
    db.collection('attendance')
        .where('studentId', '==', userId)
        .orderBy('timestamp', 'desc')
        .get()
        .then(snapshot => {
            attendanceData = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                attendanceData.push({
                    id: doc.id,
                    ...data,
                    dateObj: data.timestamp ? data.timestamp.toDate() : new Date(),
                    date: data.timestamp ? formatDate(data.timestamp.toDate()) : '',
                    time: data.timestamp ? formatTime(data.timestamp.toDate()) : '',
                });
                
                // Group by subject for charts
                if (data.subject) {
                    if (!attendanceBySubject[data.subject]) {
                        attendanceBySubject[data.subject] = {
                            present: 0,
                            absent: 0, 
                            late: 0,
                            total: 0
                        };
                        
                        if (!allSubjects.includes(data.subject)) {
                            allSubjects.push(data.subject);
                        }
                    }
                    
                    attendanceBySubject[data.subject].total++;
                    if (data.status === 'present') {
                        attendanceBySubject[data.subject].present++;
                    } else if (data.status === 'absent') {
                        attendanceBySubject[data.subject].absent++;
                    } else if (data.status === 'late') {
                        attendanceBySubject[data.subject].late++;
                    }
                }
            });
            
            // Update UI with attendance data
            updateAttendanceSummary();
            updateAttendanceRecords();
            populateSubjectFilter();
            initializeCharts();
            createAttendanceHeatmap();
            
        })
        .catch(error => {
            console.error("Error loading attendance data:", error);
        });
}

// Update attendance summary statistics
function updateAttendanceSummary() {
    let totalClasses = 0;
    let presentCount = 0;
    let absentCount = 0;
    let lateCount = 0;
    
    attendanceData.forEach(record => {
        totalClasses++;
        if (record.status === 'present') presentCount++;
        else if (record.status === 'absent') absentCount++;
        else if (record.status === 'late') lateCount++;
    });
    
    const presentPercent = totalClasses > 0 ? Math.round((presentCount / totalClasses) * 100) : 0;
    const absentPercent = totalClasses > 0 ? Math.round((absentCount / totalClasses) * 100) : 0;
    const latePercent = totalClasses > 0 ? Math.round((lateCount / totalClasses) * 100) : 0;
    
    // Update stats
    document.getElementById('total-classes').textContent = totalClasses;
    document.getElementById('classes-attended').textContent = presentCount;
    document.getElementById('classes-absent').textContent = absentCount;
    document.getElementById('current-streak').textContent = calculateCurrentStreak() + ' days';
    
    // Update percentage circles
    document.getElementById('present-percent').textContent = presentPercent + '%';
    document.getElementById('absent-percent').textContent = absentPercent + '%';
    document.getElementById('late-percent').textContent = latePercent + '%';
    
    // Update circle visual percentages using CSS variables
    document.getElementById('present-circle').style.setProperty('--percentage', `${presentPercent}%`);
    document.getElementById('absent-circle').style.setProperty('--percentage', `${absentPercent}%`);
    document.getElementById('late-circle').style.setProperty('--percentage', `${latePercent}%`);
}

// Calculate current attendance streak
function calculateCurrentStreak() {
    // Sort data by date (most recent first)
    const sortedData = [...attendanceData].sort((a, b) => b.dateObj - a.dateObj);
    let streak = 0;
    
    for (let i = 0; i < sortedData.length; i++) {
        if (sortedData[i].status === 'present') {
            streak++;
        } else {
            break; // Stop counting streak once we hit an absence
        }
    }
    
    return streak;
}

// Update attendance records table
function updateAttendanceRecords() {
    const tableBody = document.getElementById('attendance-records');
    tableBody.innerHTML = '';
    
    if (attendanceData.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = '<td colspan="5">No attendance records found.</td>';
        tableBody.appendChild(row);
        return;
    }
    
    // Group attendance by date for streak calculation
    const attendanceByDate = {};
    attendanceData.forEach(record => {
        const dateStr = formatDate(record.dateObj);
        if (!attendanceByDate[dateStr]) {
            attendanceByDate[dateStr] = record.status;
        }
    });
    
    // Get dates sorted in ascending order for streak visualization
    const sortedDates = Object.keys(attendanceByDate).sort((a, b) => 
        new Date(a) - new Date(b)
    );
    
    // For each attendance record
    attendanceData.forEach(record => {
        const row = document.createElement('tr');
        
        // Get the position of this date in the overall timeline
        const dateStr = formatDate(record.dateObj);
        const dateIndex = sortedDates.indexOf(dateStr);
        
        // Get a 5-day attendance window centered on this date if possible
        let streakWindow = [];
        for (let i = Math.max(0, dateIndex - 2); i < Math.min(sortedDates.length, dateIndex + 3); i++) {
            const date = sortedDates[i];
            streakWindow.push({
                date: date,
                status: attendanceByDate[date]
            });
        }
        
        // Calculate streak for this date
        let currentStreak = 0;
        for (let i = 0; i <= dateIndex; i++) {
            if (attendanceByDate[sortedDates[i]] === 'present') {
                currentStreak++;
            } else {
                currentStreak = 0;
            }
        }
        
        // Create status badge
        let statusBadge = '';
        if (record.status === 'present') {
            statusBadge = '<span class="status-badge status-present"><i class="fas fa-check-circle"></i> Present</span>';
        } else if (record.status === 'absent') {
            statusBadge = '<span class="status-badge status-absent"><i class="fas fa-times-circle"></i> Absent</span>';
        } else if (record.status === 'late') {
            statusBadge = '<span class="status-badge status-late"><i class="fas fa-clock"></i> Late</span>';
        }
        
        // Build streak visualization
        let streakDays = '';
        streakWindow.forEach(day => {
            streakDays += `<span class="day ${day.status}"></span>`;
        });
        
        // Create streak display
        const streakDisplay = `
            <div class="student-streak">
                <div class="streak-days">
                    ${streakDays}
                </div>
                <span class="streak-count">${currentStreak > 0 ? currentStreak + '-day streak' : 'No streak'}</span>
            </div>
        `;
        
        row.innerHTML = `
            <td>${record.date}</td>
            <td>${record.subject || 'N/A'}</td>
            <td>${statusBadge}</td>
            <td>${record.time}</td>
            <td>${streakDisplay}</td>
        `;
        
        tableBody.appendChild(row);
    });
}

// Populate subject filter dropdown
function populateSubjectFilter() {
    const subjectFilter = document.getElementById('subject-filter');
    subjectFilter.innerHTML = '<option value="">All Subjects</option>';
    
    allSubjects.forEach(subject => {
        const option = document.createElement('option');
        option.value = subject;
        option.textContent = subject;
        subjectFilter.appendChild(option);
    });
    
    // Add event listener for filter changes
    subjectFilter.addEventListener('change', filterAttendanceRecords);
}

// Filter attendance records by subject and date
function filterAttendanceRecords() {
    const subjectFilter = document.getElementById('subject-filter').value;
    const monthFilter = document.getElementById('month-filter').value;
    
    let filteredData = [...attendanceData];
    
    if (subjectFilter) {
        filteredData = filteredData.filter(record => record.subject === subjectFilter);
    }
    
    if (monthFilter) {
        const [year, month] = monthFilter.split('-');
        filteredData = filteredData.filter(record => {
            return record.dateObj.getFullYear() === parseInt(year) && 
                   record.dateObj.getMonth() === parseInt(month) - 1;
        });
    }
    
    // Update table with filtered data
    // (This would require refactoring the updateAttendanceRecords function to accept data)
    // For now, we'll just log the filtered data
    console.log("Filtered data:", filteredData);
    // TODO: Update table with filtered data
}

// Replace the initializeCharts function with this placeholder version
function initializeCharts() {
    // Temporarily disabled charts due to rendering issues
    console.log("Charts temporarily disabled");
    
    // Add placeholder elements instead
    const dailyChartElement = document.getElementById('daily-attendance-chart');
    if (dailyChartElement) {
        dailyChartElement.parentNode.innerHTML = `
            <div class="chart-placeholder">
                <p><i class="fas fa-chart-line"></i> Charts temporarily disabled</p>
                <p class="text-muted">Attendance visualization will be available in a future update</p>
            </div>
        `;
    }
    
    const subjectChartElement = document.getElementById('subject-attendance-chart');
    if (subjectChartElement) {
        subjectChartElement.parentNode.innerHTML = `
            <div class="chart-placeholder">
                <p><i class="fas fa-chart-bar"></i> Subject charts temporarily disabled</p>
                <p class="text-muted">Subject breakdown will be available soon</p>
            </div>
        `;
    }
}

// Create the attendance heatmap
function createAttendanceHeatmap() {
    const heatmapContainer = document.getElementById('attendance-heatmap');
    heatmapContainer.innerHTML = '';
    
    // Create a 6-month calendar (today and 5 months back)
    const today = new Date();
    const startDate = new Date(today);
    startDate.setMonth(today.getMonth() - 5);
    startDate.setDate(1); // Start at the beginning of the month
    
    // Create map of attendance data by date
    const attendanceMap = {};
    attendanceData.forEach(record => {
        const dateStr = formatDateIso(record.dateObj);
        attendanceMap[dateStr] = record.status;
    });
    
    // Calculate the number of days to render
    const endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0); // Last day of current month
    const dayCount = Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
    
    // Generate the heatmap
    for (let i = 0; i < dayCount; i++) {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + i);
        
        const dateStr = formatDateIso(date);
        const status = attendanceMap[dateStr] || 'no-data';
        
        const dayElement = document.createElement('div');
        dayElement.className = `heatmap-day ${status}`;
        dayElement.setAttribute('title', `${formatDate(date)}: ${status === 'no-data' ? 'No Class' : status}`);
        dayElement.innerHTML = date.getDate();
        
        heatmapContainer.appendChild(dayElement);
        
        // Add month label at beginning of each month
        if (date.getDate() === 1 || i === 0) {
            const monthLabel = document.createElement('div');
            monthLabel.className = 'heatmap-month-label';
            monthLabel.textContent = date.toLocaleString('default', { month: 'short' });
            heatmapContainer.appendChild(monthLabel);
        }
    }
}

// Helper function: Format date in readable format
function formatDate(date) {
    return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
    });
}

// Helper function: Format date in short format for charts
function formatShortDate(date) {
    return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
    });
}

// Helper function: Format time in readable format
function formatTime(date) {
    return date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
}

// Helper function: Format date in ISO format (YYYY-MM-DD)
function formatDateIso(date) {
    return date.toISOString().split('T')[0];
}