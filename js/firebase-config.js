// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyDISqpYGt7KoMAZU0xQDyeyHnf1_8F2Fds",
    authDomain: "smart-attendance-app-c5efa.firebaseapp.com",
    projectId: "smart-attendance-app-c5efa",
    storageBucket: "smart-attendance-app-c5efa.appspot.com",
    messagingSenderId: "255263206573",
    appId: "1:255263206573:web:6412c2a10e98e73dc4aa24",
    measurementId: "G-45R10D313P"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize services
const auth = firebase.auth();
const db = firebase.firestore();

// Global constants
const ROLES = {
    ADMIN: 'admin',
    TEACHER: 'teacher',
    STUDENT: 'student'
};

// School location (for geofencing)


// Azure Function URL
const AZURE_FUNCTION_URL = "https://your-function-url.azurewebsites.net/api/attendanceLogger";

console.log("Firebase config loaded successfully");