import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  startAfter,
  updateDoc,
  where
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import { auth, db } from './firebase-config.js';

function requireUser() {
  if (!auth.currentUser) throw new Error('Entre na sua conta Google para acessar seus dados.');
  return auth.currentUser;
}

function privateCollection(collectionName) {
  const user = requireUser();
  return collection(db, 'users', user.uid, collectionName);
}

function publicCollection(collectionName) {
  return collection(db, 'publicContent', collectionName, 'items');
}

export async function ensureUserProfile(user) {
  const profileRef = doc(db, 'users', user.uid);
  const existing = await getDoc(profileRef);
  if (!existing.exists()) {
    await setDoc(profileRef, {
      uid: user.uid,
      displayName: user.displayName || '',
      email: user.email || '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }
}

export async function listUserRecords(collectionName, maxItems = 50) {
  const result = await getDocs(query(privateCollection(collectionName), orderBy('updatedAt', 'desc'), limit(maxItems)));
  return result.docs.map((snapshot) => ({ id: snapshot.id, ...snapshot.data() }));
}

export async function saveUserRecord(collectionName, data, id = null) {
  const target = id ? doc(privateCollection(collectionName), id) : doc(privateCollection(collectionName));
  const existing = id ? await getDoc(target) : null;
  const payload = {
    ...data,
    updatedAt: serverTimestamp(),
    createdAt: existing?.exists() ? existing.data().createdAt : serverTimestamp()
  };
  await setDoc(target, payload, { merge: false });
  return target.id;
}

export async function removeUserRecord(collectionName, id) {
  await deleteDoc(doc(privateCollection(collectionName), id));
}

export async function getPublishedNews({ cursor = null, pageSize = 10 } = {}) {
  const base = [where('status', '==', 'published'), orderBy('publishedAt', 'desc'), limit(pageSize)];
  const pageQuery = cursor ? query(publicCollection('news'), ...base.slice(0, 2), startAfter(cursor), limit(pageSize)) : query(publicCollection('news'), ...base);
  const snapshot = await getDocs(pageQuery);
  return { items: snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })), cursor: snapshot.docs.at(-1) || null, hasMore: snapshot.docs.length === pageSize };
}

export async function getActiveLinks(maxItems = 60) {
  const snapshot = await getDocs(query(publicCollection('officialLinks'), where('active', '==', true), orderBy('order', 'asc'), limit(maxItems)));
  return snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
}

export async function getPublishedSalaryTables(maxItems = 100) {
  const snapshot = await getDocs(query(publicCollection('salaryTables'), where('status', '==', 'published'), orderBy('effectiveAt', 'desc'), limit(maxItems)));
  return snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
}

export async function listAdminRecords(collectionName, maxItems = 50) {
  requireUser();
  const snapshot = await getDocs(query(publicCollection(collectionName), orderBy('updatedAt', 'desc'), limit(maxItems)));
  return snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
}

export async function saveAdminRecord(collectionName, data, id = null) {
  requireUser();
  const target = id ? doc(publicCollection(collectionName), id) : doc(publicCollection(collectionName));
  const existing = id ? await getDoc(target) : null;
  const payload = {
    ...data,
    updatedAt: serverTimestamp(),
    createdAt: existing?.exists() ? existing.data().createdAt : serverTimestamp()
  };
  await setDoc(target, payload);
  return target.id;
}

export async function removeAdminRecord(collectionName, id) {
  requireUser();
  await deleteDoc(doc(publicCollection(collectionName), id));
}

export async function savePublicConfig(id, data) {
  requireUser();
  await setDoc(doc(db, 'appConfig', id), { ...data, updatedAt: serverTimestamp() }, { merge: true });
}

export async function readPublicConfig(id) {
  const snapshot = await getDoc(doc(db, 'appConfig', id));
  return snapshot.exists() ? snapshot.data() : null;
}

