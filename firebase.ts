import firebase from "firebase/compat/app";
import "firebase/compat/firestore";
import { PackageLog, User } from './types';

// --- CONFIGURATION ---
const firebaseConfig = {
  apiKey: "AIzaSyCtzgOR0BQO2F8Pidf_RjdwzmO10RHWnkk",
  authDomain: "timetrackingapp-c8324.firebaseapp.com",
  projectId: "timetrackingapp-c8324",
  storageBucket: "timetrackingapp-c8324.firebasestorage.app",
  messagingSenderId: "314302007648",
  appId: "1:314302007648:web:7c8c6faa45384e11f5f605"
};

// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);

// Initialize Firestore
const db = app.firestore();

// Enable Offline Persistence
// We swallow errors here because some environments (like private tabs) don't support IDB
db.enablePersistence().catch((err) => {
  if (err.code == 'failed-precondition') {
      console.warn("Firestore persistence failed: Multiple tabs open");
  } else if (err.code == 'unimplemented') {
      console.warn("Firestore persistence not supported in this browser");
  }
});

// Collection References
const LOGS_COL = 'packtrack_logs';
const USERS_COL = 'packtrack_users';

// --- LISTENERS (REAL-TIME SYNC) ---

export const subscribeToLogs = (
  onData: (logs: PackageLog[]) => void, 
  onError?: (error: any) => void
) => {
  const q = db.collection(LOGS_COL);
  return q.onSnapshot(
    (snapshot) => {
      const logs = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as PackageLog[];
      onData(logs);
    }, 
    (error) => {
      console.error("Error fetching logs:", error);
      if (onError) onError(error);
    }
  );
};

export const subscribeToUsers = (
  onData: (users: User[]) => void, 
  onError?: (error: any) => void
) => {
  const q = db.collection(USERS_COL);
  return q.onSnapshot(
    (snapshot) => {
      const users = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as User[];
      onData(users);
    },
    (error) => {
      console.error("Error fetching users:", error);
      if (onError) onError(error);
    }
  );
};

// --- LOG OPERATIONS ---

export const addLogEntry = async (log: Omit<PackageLog, 'id'>) => {
  // 1. Find any active logs and clock them out first
  // We query for logs where endTime is null
  const logsRef = db.collection(LOGS_COL);
  const snapshot = await logsRef.where("endTime", "==", null).get();
  
  const batch = db.batch();
  let hasUpdates = false;

  if (!snapshot.empty) {
    snapshot.docs.forEach(activeDoc => {
      batch.update(activeDoc.ref, { endTime: Date.now() });
      hasUpdates = true;
    });
  }

  // 2. Add the new log
  // We can add the new doc in the same batch or separately. 
  // Firestore batches are for writes/deletes/updates, addDoc returns a Ref, so we usually do it after.
  if (hasUpdates) {
    await batch.commit();
  }

  await logsRef.add(log);
};

export const clockOutActiveLog = async (logId: string) => {
  const logRef = db.collection(LOGS_COL).doc(logId);
  await logRef.update({
    endTime: Date.now()
  });
};

export const autoTimeoutLog = async (logId: string, startTime: number, timeoutDuration: number) => {
  const logRef = db.collection(LOGS_COL).doc(logId);
  await logRef.update({
    endTime: startTime + timeoutDuration
  });
};

export const deleteLogEntry = async (logId: string) => {
  const logRef = db.collection(LOGS_COL).doc(logId);
  await logRef.delete();
};

export const clearAllSystemData = async () => {
  const batch = db.batch();
  
  const logsSnap = await db.collection(LOGS_COL).get();
  logsSnap.forEach(d => batch.delete(d.ref));
  
  const usersSnap = await db.collection(USERS_COL).get();
  usersSnap.forEach(d => batch.delete(d.ref));
  
  await batch.commit();
};

// --- USER OPERATIONS ---

export const addUser = async (user: Omit<User, 'id'>) => {
  await db.collection(USERS_COL).add(user);
};

export const updateUser = async (userId: string, data: Partial<User>) => {
  const userRef = db.collection(USERS_COL).doc(userId);
  await userRef.update(data);
};

export const deleteUser = async (userId: string) => {
  const userRef = db.collection(USERS_COL).doc(userId);
  await userRef.delete();
};