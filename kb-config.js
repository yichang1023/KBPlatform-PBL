/* 雲端設定(Firebase 網頁設定本來就是公開資訊,安全性靠 Firestore 規則,不是靠隱藏這些值) */
window.KB_CLOUD = {
  firebase: {
    apiKey: "AIzaSyDPjtxtf656JHVVlj1o4cLwSylo1jDBFAc",
    authDomain: "kb-platform-1.firebaseapp.com",
    projectId: "kb-platform-1",
    storageBucket: "kb-platform-1.firebasestorage.app",
    messagingSenderId: "230026226847",
    appId: "1:230026226847:web:49e6f09ddfc3de0ef046aa"
  },
  collection: 'kb_v2',
  auditCollection: 'kb_v2_audit'
};
