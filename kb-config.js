/* 雲端設定(Firebase 網頁設定本來就是公開資訊,安全性靠 Firestore 規則,不是靠隱藏這些值) */
window.KB_CLOUD = {
  firebase: {
    apiKey: "AIzaSyAcSDJQjNFOVg9Mk998A0mbJJilnGzUZbo",
    authDomain: "kb-forum.firebaseapp.com",
    projectId: "kb-forum",
    storageBucket: "kb-forum.firebasestorage.app",
    messagingSenderId: "701882269490",
    appId: "1:701882269490:web:699e9f19c803a8dd8d612b"
  },
  collection: 'kb_v2',
  auditCollection: 'kb_v2_audit'
};
