
import { initializeApp } from "firebase/app";
import { 
  getFirestore, 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  where, 
  getDocs, 
  writeBatch
} from "firebase/firestore";
import { PackageLog, User, ShipmentDetails } from './types';

// --- CONFIGURATION ---
const firebaseConfig = {
  apiKey: "AIzaSyAKbvODxE_ULiag9XBXHnAJO4b-tGWSq0w",
  authDomain: "time-tracking-67712.firebaseapp.com",
  databaseURL: "https://time-tracking-67712-default-rtdb.firebaseio.com",
  projectId: "time-tracking-67712",
  storageBucket: "time-tracking-67712.firebasestorage.app",
  messagingSenderId: "829274875816",
  appId: "1:829274875816:web:ee9e8046d22a115e42df9d"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore
const db = getFirestore(app);

// NOTE: Offline persistence disabled
// Collection References
const LOGS_COL = 'packtrack_logs';
const USERS_COL = 'packtrack_users';

// --- LISTENERS (REAL-TIME SYNC) ---

export const subscribeToLogs = (
  onData: (logs: PackageLog[]) => void, 
  onError?: (error: any) => void
) => {
  const q = collection(db, LOGS_COL);
  return onSnapshot(
    q,
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
  const q = collection(db, USERS_COL);
  return onSnapshot(
    q,
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
  const logsRef = collection(db, LOGS_COL);
  const q = query(logsRef, where("endTime", "==", null));
  const snapshot = await getDocs(q);
  
  const batch = writeBatch(db);
  let hasUpdates = false;

  snapshot.docs.forEach((docSnap) => {
    batch.update(docSnap.ref, { endTime: Date.now() });
    hasUpdates = true;
  });

  if (hasUpdates) {
    await batch.commit();
  }

  await addDoc(logsRef, log);
};

export const clockOutActiveLog = async (logId: string) => {
  const logRef = doc(db, LOGS_COL, logId);
  await updateDoc(logRef, {
    endTime: Date.now()
  });
};

export const autoTimeoutLog = async (logId: string, startTime: number, timeoutDuration: number) => {
  const logRef = doc(db, LOGS_COL, logId);
  await updateDoc(logRef, {
    endTime: startTime + timeoutDuration
  });
};

export const updateLogShipmentDetails = async (logId: string, details: ShipmentDetails) => {
  const logRef = doc(db, LOGS_COL, logId);
  await updateDoc(logRef, {
    shipmentDetails: details
  });
};

export const deleteLogEntry = async (logId: string) => {
  const logRef = doc(db, LOGS_COL, logId);
  await deleteDoc(logRef);
};

export const clearAllSystemData = async () => {
  const batch = writeBatch(db);
  
  const logsSnap = await getDocs(collection(db, LOGS_COL));
  logsSnap.forEach(d => batch.delete(d.ref));
  
  const usersSnap = await getDocs(collection(db, USERS_COL));
  usersSnap.forEach(d => batch.delete(d.ref));
  
  await batch.commit();
};

// --- USER OPERATIONS ---

export const addUser = async (user: Omit<User, 'id'>) => {
  await addDoc(collection(db, USERS_COL), user);
};

export const updateUser = async (userId: string, data: Partial<User>) => {
  const userRef = doc(db, USERS_COL, userId);
  await updateDoc(userRef, data);
};

export const deleteUser = async (userId: string) => {
  const userRef = doc(db, USERS_COL, userId);
  await deleteDoc(userRef);
};
