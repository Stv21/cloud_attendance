// admin adds teachers
// Admin functionality - Manage teachers and students

document.addEventListener('DOMContentLoaded', () => {
    auth.onAuthStateChanged(user => {
        if (user) {
            // Check if user is admin
            db.collection('users').doc(user.uid).get()
                .then(doc => {
                    if (doc.exists && doc.data().role === ROLES.ADMIN) {
                        // Initialize admin dashboard
                        loadDashboardStats();
                        loadTeachers();
                        loadStudents();
                    } else {
                        // Not an admin, redirect to login
                        alert('Access denied. You must be an admin to view this page.');
                        window.location.href = 'index.html';
                    }
                });
        } else {
            // User not logged in, redirect to login
            window.location.href = 'index.html';
        }
    });

    // Initialize event listeners for forms
    document.getElementById('add-teacher-form').addEventListener('submit', addTeacher);
    document.getElementById('add-student-form').addEventListener('submit', addStudent);
});

// Load dashboard statistics
function loadDashboardStats() {
    // Count teachers
    db.collection('users').where('role', '==', ROLES.TEACHER).get()
        .then(snapshot => {
            document.getElementById('teacher-count').textContent = snapshot.size;
        });
    
    // Count students
    db.collection('users').where('role', '==', ROLES.STUDENT).get()
        .then(snapshot => {
            document.getElementById('student-count').textContent = snapshot.size;
        });
    
    // Count today's attendance
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    db.collection('attendance')
        .where('timestamp', '>=', today)
        .get()
        .then(snapshot => {
            document.getElementById('attendance-count').textContent = snapshot.size;
        });
}

// Load all teachers
function loadTeachers() {
    const teacherList = document.getElementById('teacher-list');
    teacherList.innerHTML = '';
    
    db.collection('users')
        .where('role', '==', ROLES.TEACHER)
        .get()
        .then(snapshot => {
            if (snapshot.empty) {
                teacherList.innerHTML = '<tr><td colspan="4">No teachers found</td></tr>';
                return;
            }
            
            snapshot.forEach(doc => {
                const teacher = doc.data();
                const row = document.createElement('tr');
                
                row.innerHTML = `
                    <td>${teacher.name}</td>
                    <td>${teacher.email}</td>
                    <td>${teacher.department || 'N/A'}</td>
                    <td>
                        <button class="btn btn-warning btn-sm" onclick="editTeacher('${doc.id}')">Edit</button>
                        <button class="btn btn-danger btn-sm" onclick="deleteTeacher('${doc.id}')">Delete</button>
                    </td>
                `;
                
                teacherList.appendChild(row);
            });
        })
        .catch(error => {
            console.error('Error loading teachers:', error);
            teacherList.innerHTML = '<tr><td colspan="4">Error loading teachers</td></tr>';
        });
}

// Load all students
function loadStudents() {
    const studentList = document.getElementById('student-list');
    studentList.innerHTML = '';
    
    db.collection('users')
        .where('role', '==', ROLES.STUDENT)
        .get()
        .then(snapshot => {
            if (snapshot.empty) {
                studentList.innerHTML = '<tr><td colspan="5">No students found</td></tr>';
                return;
            }
            
            snapshot.forEach(doc => {
                const student = doc.data();
                const row = document.createElement('tr');
                
                row.innerHTML = `
                    <td>${student.name}</td>
                    <td>${student.rollNo || 'N/A'}</td>
                    <td>${student.className || 'N/A'}</td>
                    <td>${student.email}</td>
                    <td>
                        <button class="btn btn-warning btn-sm" onclick="editStudent('${doc.id}')">Edit</button>
                        <button class="btn btn-danger btn-sm" onclick="deleteStudent('${doc.id}')">Delete</button>
                    </td>
                `;
                
                studentList.appendChild(row);
            });
        })
        .catch(error => {
            console.error('Error loading students:', error);
            studentList.innerHTML = '<tr><td colspan="5">Error loading students</td></tr>';
        });
}

// Add a new teacher
function addTeacher(e) {
    e.preventDefault();
    
    const name = document.getElementById('teacher-name').value;
    const email = document.getElementById('teacher-email').value;
    const department = document.getElementById('teacher-department').value;
    const password = 'teacher123'; // Default password, should be changed on first login
    
    // Create user in Firebase Authentication
    auth.createUserWithEmailAndPassword(email, password)
        .then(userCredential => {
            const userId = userCredential.user.uid;
            
            // Add user data to Firestore
            return db.collection('users').doc(userId).set({
                name: name,
                email: email,
                department: department,
                role: ROLES.TEACHER,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        })
        .then(() => {
            alert('Teacher added successfully!');
            document.getElementById('add-teacher-form').reset();
            loadTeachers(); // Refresh list
        })
        .catch(error => {
            console.error('Error adding teacher:', error);
            alert('Error adding teacher: ' + error.message);
        });
}

// Add a new student
function addStudent(e) {
    e.preventDefault();
    
    const name = document.getElementById('student-name').value;
    const email = document.getElementById('student-email').value;
    const rollNo = document.getElementById('student-roll').value;
    const className = document.getElementById('student-class').value;
    const password = 'student123'; // Default password, should be changed on first login
    
    // Create user in Firebase Authentication
    auth.createUserWithEmailAndPassword(email, password)
        .then(userCredential => {
            const userId = userCredential.user.uid;
            
            // Add user data to Firestore
            return db.collection('users').doc(userId).set({
                name: name,
                email: email,
                rollNo: rollNo,
                className: className,
                role: ROLES.STUDENT,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        })
        .then(() => {
            alert('Student added successfully!');
            document.getElementById('add-student-form').reset();
            loadStudents(); // Refresh list
        })
        .catch(error => {
            console.error('Error adding student:', error);
            alert('Error adding student: ' + error.message);
        });
}

// Edit teacher
function editTeacher(teacherId) {
    db.collection('users').doc(teacherId).get()
        .then(doc => {
            if (!doc.exists) {
                alert('Teacher not found!');
                return;
            }
            
            const teacher = doc.data();
            
            // Populate form for editing
            document.getElementById('teacher-name').value = teacher.name;
            document.getElementById('teacher-email').value = teacher.email;
            document.getElementById('teacher-department').value = teacher.department || '';
            
            // Update form submission handler
            const form = document.getElementById('add-teacher-form');
            form.removeEventListener('submit', addTeacher);
            
            form.addEventListener('submit', function onSubmit(e) {
                e.preventDefault();
                
                db.collection('users').doc(teacherId).update({
                    name: document.getElementById('teacher-name').value,
                    department: document.getElementById('teacher-department').value
                    // Not updating email as it requires re-authentication
                })
                .then(() => {
                    alert('Teacher updated successfully!');
                    form.reset();
                    form.removeEventListener('submit', onSubmit);
                    form.addEventListener('submit', addTeacher);
                    loadTeachers();
                })
                .catch(error => {
                    console.error('Error updating teacher:', error);
                    alert('Error updating teacher: ' + error.message);
                });
            });
        })
        .catch(error => {
            console.error('Error loading teacher data:', error);
            alert('Error: ' + error.message);
        });
}

// Delete teacher
function deleteTeacher(teacherId) {
    if (!confirm('Are you sure you want to delete this teacher? This action cannot be undone.')) {
        return;
    }
    
    db.collection('users').doc(teacherId).get()
        .then(doc => {
            if (!doc.exists) {
                alert('Teacher not found!');
                return;
            }
            
            // First delete from Firestore
            return db.collection('users').doc(teacherId).delete();
        })
        .then(() => {
            // Then get the user from Auth and delete
            return firebase.auth().currentUser.getIdToken(true);
        })
        .then(token => {
            // Would need admin SDK or Cloud Function to delete auth user
            // For now, just show success message
            alert('Teacher deleted successfully from the database. Auth account requires server-side deletion.');
            loadTeachers();
        })
        .catch(error => {
            console.error('Error deleting teacher:', error);
            alert('Error: ' + error.message);
        });
}

// Edit student
function editStudent(studentId) {
    db.collection('users').doc(studentId).get()
        .then(doc => {
            if (!doc.exists) {
                alert('Student not found!');
                return;
            }
            
            const student = doc.data();
            
            // Populate form for editing
            document.getElementById('student-name').value = student.name;
            document.getElementById('student-email').value = student.email;
            document.getElementById('student-roll').value = student.rollNo || '';
            document.getElementById('student-class').value = student.className || '';
            
            // Update form submission handler
            const form = document.getElementById('add-student-form');
            form.removeEventListener('submit', addStudent);
            
            form.addEventListener('submit', function onSubmit(e) {
                e.preventDefault();
                
                db.collection('users').doc(studentId).update({
                    name: document.getElementById('student-name').value,
                    rollNo: document.getElementById('student-roll').value,
                    className: document.getElementById('student-class').value
                    // Not updating email as it requires re-authentication
                })
                .then(() => {
                    alert('Student updated successfully!');
                    form.reset();
                    form.removeEventListener('submit', onSubmit);
                    form.addEventListener('submit', addStudent);
                    loadStudents();
                })
                .catch(error => {
                    console.error('Error updating student:', error);
                    alert('Error updating student: ' + error.message);
                });
            });
        })
        .catch(error => {
            console.error('Error loading student data:', error);
            alert('Error: ' + error.message);
        });
}

// Delete student
function deleteStudent(studentId) {
    if (!confirm('Are you sure you want to delete this student? This action cannot be undone.')) {
        return;
    }
    
    db.collection('users').doc(studentId).get()
        .then(doc => {
            if (!doc.exists) {
                alert('Student not found!');
                return;
            }
            
            // First delete from Firestore
            return db.collection('users').doc(studentId).delete();
        })
        .then(() => {
            // Then get the user from Auth and delete
            return firebase.auth().currentUser.getIdToken(true);
        })
        .then(token => {
            // Would need admin SDK or Cloud Function to delete auth user
            // For now, just show success message
            alert('Student deleted successfully from the database. Auth account requires server-side deletion.');
            loadStudents();
        })
        .catch(error => {
            console.error('Error deleting student:', error);
            alert('Error: ' + error.message);
        });
}

// Generate attendance report
function generateReport() {
    const className = document.getElementById('report-class').value;
    const dateStr = document.getElementById('report-date').value;
    
    if (!dateStr) {
        alert('Please select a date');
        return;
    }
    
    const selectedDate = new Date(dateStr);
    const nextDay = new Date(selectedDate);
    nextDay.setDate(nextDay.getDate() + 1);
    
    let query = db.collection('attendance')
        .where('timestamp', '>=', selectedDate)
        .where('timestamp', '<', nextDay);
    
    if (className) {
        query = query.where('className', '==', className);
    }
    
    query.get()
        .then(snapshot => {
            const reportContainer = document.getElementById('report-container');
            
            if (snapshot.empty) {
                reportContainer.innerHTML = '<div class="alert alert-info">No attendance records found for the selected date.</div>';
                return;
            }
            
            // Process data for report
            const attendanceBySubject = {};
            snapshot.forEach(doc => {
                const data = doc.data();
                const subject = data.subject || 'Unknown';
                
                if (!attendanceBySubject[subject]) {
                    attendanceBySubject[subject] = {
                        present: 0,
                        total: 0
                    };
                }
                
                attendanceBySubject[subject].present++;
            });
            
            // Get total students for each subject's class
            const classQuery = className ? 
                db.collection('users').where('role', '==', ROLES.STUDENT).where('className', '==', className) :
                db.collection('users').where('role', '==', ROLES.STUDENT);
            
            classQuery.get()
                .then(studentSnapshot => {
                    const totalStudents = studentSnapshot.size;
                    
                    // Update total for each subject
                    Object.keys(attendanceBySubject).forEach(subject => {
                        attendanceBySubject[subject].total = totalStudents;
                    });
                    
                    // Generate report HTML
                    let reportHTML = `
                        <h3>Attendance Report for ${dateStr}</h3>
                        <table>
                            <thead>
                                <tr>
                                    <th>Subject</th>
                                    <th>Present</th>
                                    <th>Total</th>
                                    <th>Percentage</th>
                                </tr>
                            </thead>
                            <tbody>
                    `;
                    
                    Object.keys(attendanceBySubject).forEach(subject => {
                        const data = attendanceBySubject[subject];
                        const percentage = (data.present / data.total * 100).toFixed(2);
                        
                        reportHTML += `
                            <tr>
                                <td>${subject}</td>
                                <td>${data.present}</td>
                                <td>${data.total}</td>
                                <td>${percentage}%</td>
                            </tr>
                        `;
                    });
                    
                    reportHTML += '</tbody></table>';
                    
                    reportContainer.innerHTML = reportHTML;
                });
        })
        .catch(error => {
            console.error('Error generating report:', error);
            document.getElementById('report-container').innerHTML = '<div class="alert alert-danger">Error generating report: ' + error.message + '</div>';
        });
}