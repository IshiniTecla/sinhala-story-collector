import React, { useState, useEffect } from 'react';
import {
  Camera, Save, Database, Trash2, FileText,
  CheckCircle, XCircle, BookOpen, Download,
  AlertCircle, Loader2, Info
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import {
  getFirestore, collection, addDoc, deleteDoc, doc,
  onSnapshot, query, orderBy, serverTimestamp
} from 'firebase/firestore';

// --- FIREBASE CONFIGURATION ---
// We define the configuration here so the app is self-contained.
// For your LOCAL project, replace the object below with your REAL keys from the Firebase Console.
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {
  apiKey: "REPLACE_WITH_YOUR_REAL_API_KEY",
  authDomain: "REPLACE_WITH_YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "REPLACE_WITH_YOUR_PROJECT_ID",
  storageBucket: "REPLACE_WITH_YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "REPLACE_WITH_YOUR_SENDER_ID",
  appId: "REPLACE_WITH_YOUR_APP_ID"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- CONFIGURATION FOR PREVIEW ENVIRONMENT ---
// We sanitize the App ID to ensure it works in this specific preview window.
// In your local Vercel deployment, you can simplify this to just use your collection name.
const RAW_APP_ID = (typeof __app_id !== 'undefined' && __app_id) ? __app_id : 'sinhala-research-v1';
const APP_ID = RAW_APP_ID.replace(/[^a-zA-Z0-9-_]/g, '_');
const COLLECTION_NAME = 'sinhala_story_dataset';

export default function App() {
  const [user, setUser] = useState(null);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('collect');
  const [permissionError, setPermissionError] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    grade: 'Grade 1',
    related: '',
    unrelated: '',
    question: '',
    keywords: ''
  });
  const [imageBase64, setImageBase64] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState(null);

  // --- 1. Authentication ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        // Internal check: Use custom token if available in this preview environment
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          const { signInWithCustomToken } = await import('firebase/auth');
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          // Standard anonymous sign-in for your local app
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Auth Error:", error);
        showNotification("Authentication Failed. Check console.", "error");
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  // --- 2. Real-time Data Sync ---
  useEffect(() => {
    if (!user) return;

    try {
      // NOTE: In your local project, you can use: collection(db, 'sinhala_story_dataset')
      // We use this long path here only to make the preview work safely.
      const collectionRef = collection(db, 'artifacts', APP_ID, 'public', 'data', COLLECTION_NAME);

      const q = query(
        collectionRef,
        orderBy('createdAt', 'desc')
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setEntries(data);
        setLoading(false);
        setPermissionError(false);
      }, (error) => {
        console.error("Data Fetch Error:", error);
        setLoading(false);
        if (error.code === 'permission-denied') {
          setPermissionError(true);
        }
      });

      return () => unsubscribe();
    } catch (err) {
      console.error("Setup error:", err);
      setLoading(false);
    }
  }, [user]);

  // Helper: Show Toast Notifications
  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // Helper: Convert Image to Base64 string
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 500 * 1024) {
      showNotification("Image too large! Please use an image under 500KB.", "error");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setImageBase64(reader.result);
    };
    reader.readAsDataURL(file);
  };

  // --- 3. Submit Data ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) return showNotification("Connecting to database...", "error");
    if (!imageBase64) return showNotification("Please upload an image.", "error");

    setIsSubmitting(true);

    try {
      const collectionRef = collection(db, 'artifacts', APP_ID, 'public', 'data', COLLECTION_NAME);

      await addDoc(collectionRef, {
        ...formData,
        imageUrl: imageBase64,
        keywords: formData.keywords ? formData.keywords.split(',').map(k => k.trim()) : [],
        createdAt: serverTimestamp(),
        authorId: user.uid
      });

      showNotification("Data Saved Successfully!");

      setFormData({
        grade: 'Grade 1',
        related: '',
        unrelated: '',
        question: '',
        keywords: ''
      });
      setImageBase64(null);
    } catch (error) {
      console.error("Save error:", error);
      if (error.code === 'permission-denied') {
        showNotification("Permission Denied. Check Firestore Rules.", "error");
      } else {
        showNotification("Failed to save. Check console.", "error");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- 4. Delete Data ---
  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this entry?")) return;
    try {
      const docRef = doc(db, 'artifacts', APP_ID, 'public', 'data', COLLECTION_NAME, id);
      await deleteDoc(docRef);
      showNotification("Entry deleted.", "success");
    } catch (error) {
      console.error("Delete error", error);
      showNotification("Delete failed.", "error");
    }
  };

  // --- 5. Export JSON ---
  const handleExport = () => {
    const jsonString = `data:text/json;chatset=utf-8,${encodeURIComponent(
      JSON.stringify(entries, null, 2)
    )}`;
    const link = document.createElement("a");
    link.href = jsonString;
    link.download = "sinhala_dataset.json";
    link.click();
  };

  return (
    <div className="min-h-screen font-sans text-slate-800 pb-10 bg-slate-50">
      {/* Navbar */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-3">
              <div className="bg-indigo-600 p-2 rounded-lg text-white">
                <BookOpen size={20} />
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-900">Sinhala Data Collector</h1>
                <p className="text-xs text-slate-500">Research Tool v1.0</p>
              </div>
            </div>
            <div className="flex bg-slate-100 p-1 rounded-lg">
              <button
                onClick={() => setActiveTab('collect')}
                className={`px-4 py-1.5 rounded text-sm font-medium transition-all ${activeTab === 'collect' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Enter Data
              </button>
              <button
                onClick={() => setActiveTab('dataset')}
                className={`px-4 py-1.5 rounded text-sm font-medium transition-all ${activeTab === 'dataset' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
              >
                View Data ({entries.length})
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Notification Toast */}
      {notification && (
        <div className={`fixed top-20 right-5 px-6 py-4 rounded-lg shadow-xl border-l-4 text-white z-50 animate-fade-in ${notification.type === 'success' ? 'bg-emerald-600 border-emerald-800' : 'bg-rose-600 border-rose-800'}`}>
          <div className="flex items-center gap-3">
            {notification.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
            <p className="font-medium">{notification.message}</p>
          </div>
        </div>
      )}

      {/* Permission Error Banner */}
      {permissionError && (
        <div className="max-w-6xl mx-auto mt-6 px-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3 text-amber-900">
            <Info className="shrink-0 mt-0.5 text-amber-600" />
            <div>
              <h3 className="font-bold text-sm">Database Connection Restricted</h3>
              <p className="text-sm mt-1 opacity-90">
                This preview window may restrict database access. To use this app fully:
                <br />
                1. Download this code.
                <br />
                2. Run it on your local computer (localhost).
                <br />
                3. Ensure you pasted your <strong>own Firebase API Keys</strong> in the configuration section.
              </p>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-6xl mx-auto px-4 py-8">
        {activeTab === 'collect' ? (
          /* --- COLLECTION VIEW --- */
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
            {/* Left: Image Upload */}
            <div className="md:col-span-4 space-y-4">
              <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                <h2 className="font-semibold mb-4 flex items-center gap-2 text-slate-700">
                  <Camera size={18} className="text-indigo-600" /> 1. Source Image
                </h2>

                <div className={`border-2 border-dashed rounded-xl p-4 text-center h-64 flex flex-col justify-center items-center transition-all ${imageBase64 ? 'border-indigo-300 bg-indigo-50' : 'border-slate-300 hover:bg-slate-50'}`}>
                  {imageBase64 ? (
                    <div className="relative w-full h-full group">
                      <img src={imageBase64} alt="Preview" className="w-full h-full object-contain rounded" />
                      <button
                        onClick={() => setImageBase64(null)}
                        className="absolute top-2 right-2 bg-white p-2 rounded-full text-rose-500 shadow-md hover:bg-rose-50 transition-transform transform hover:scale-110"
                        title="Remove Image"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ) : (
                    <label className="cursor-pointer w-full h-full flex flex-col items-center justify-center">
                      <div className="bg-indigo-100 text-indigo-600 p-3 rounded-full mb-2"><Camera size={24} /></div>
                      <span className="text-sm font-medium text-slate-900">Upload Image</span>
                      <span className="text-xs text-slate-400 mt-1">Max 500KB (JPG/PNG)</span>
                      <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                    </label>
                  )}
                </div>

                <div className="mt-4">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Grade Level</label>
                  <select
                    className="w-full mt-1 border border-slate-300 rounded-lg p-2.5 bg-slate-50 text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={formData.grade}
                    onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
                  >
                    <option>Grade 1 (Basic Spoken)</option>
                    <option>Grade 2 (Simple Sentences)</option>
                    <option>Grade 3 (Intermediate)</option>
                    <option>Grade 4 (Advanced)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Right: Annotation Form */}
            <div className="md:col-span-8">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <h2 className="font-semibold mb-6 flex items-center gap-2 text-slate-700">
                  <FileText size={18} className="text-indigo-600" /> 2. Sinhala Annotations
                </h2>
                <form onSubmit={handleSubmit} className="space-y-5">

                  {/* Related */}
                  <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-100">
                    <label className="text-sm font-bold text-emerald-800 flex items-center gap-2 mb-2">
                      <CheckCircle size={16} /> Correct Sentence (නිවැරදි වාක්‍යය)
                    </label>
                    <textarea
                      required
                      rows={2}
                      className="w-full p-3 rounded border border-emerald-200 focus:ring-2 focus:ring-emerald-500 outline-none font-sinhala"
                      placeholder="Example: ළමයි පිට්ටනියේ සෙල්ලම් කරති."
                      value={formData.related}
                      onChange={(e) => setFormData({ ...formData, related: e.target.value })}
                    />
                  </div>

                  {/* Unrelated */}
                  <div className="bg-rose-50 p-4 rounded-lg border border-rose-100">
                    <label className="text-sm font-bold text-rose-800 flex items-center gap-2 mb-2">
                      <XCircle size={16} /> Distractor (වැරදි වාක්‍යය)
                    </label>
                    <textarea
                      required
                      rows={2}
                      className="w-full p-3 rounded border border-rose-200 focus:ring-2 focus:ring-rose-500 outline-none font-sinhala"
                      placeholder="Example: ළමයි පන්තියේ පාඩම් කරති."
                      value={formData.unrelated}
                      onChange={(e) => setFormData({ ...formData, unrelated: e.target.value })}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">Comprehension Question</label>
                      <input
                        type="text"
                        className="w-full p-2.5 rounded border border-slate-300 bg-slate-50 focus:ring-2 focus:ring-indigo-500 outline-none font-sinhala"
                        placeholder="Ex: ළමයි කරන්නේ කුමක්ද?"
                        value={formData.question}
                        onChange={(e) => setFormData({ ...formData, question: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">Keywords (Tags)</label>
                      <input
                        type="text"
                        className="w-full p-2.5 rounded border border-slate-300 bg-slate-50 focus:ring-2 focus:ring-indigo-500 outline-none"
                        placeholder="Ex: Playing, School, Happy"
                        value={formData.keywords}
                        onChange={(e) => setFormData({ ...formData, keywords: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100 flex justify-end">
                    <button
                      disabled={isSubmitting}
                      type="submit"
                      className={`
                        flex items-center gap-2 px-6 py-2.5 rounded-lg font-semibold text-white transition-all 
                        ${isSubmitting ? 'bg-slate-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 shadow-lg hover:shadow-indigo-200'}
                      `}
                    >
                      {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                      {isSubmitting ? 'Saving...' : 'Save Entry'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>

        ) : (
          /* --- DATASET VIEW --- */
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-center bg-white p-5 rounded-xl border border-slate-200 shadow-sm gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Collected Dataset</h2>
                <p className="text-slate-500 text-sm">Total Samples: <span className="font-mono font-bold text-indigo-600 text-lg">{entries.length}</span></p>
              </div>
              <button
                onClick={handleExport}
                className="bg-slate-800 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-slate-900 transition-colors text-sm font-medium"
              >
                <Download size={16} /> Export JSON
              </button>
            </div>

            {loading ? (
              <div className="text-center py-20 bg-white rounded-xl border border-slate-200">
                <Loader2 className="animate-spin mx-auto text-indigo-600 mb-3" size={32} />
                <p className="text-slate-500">Syncing with Research Database...</p>
              </div>
            ) : entries.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-xl border border-dashed border-slate-300">
                <Database size={48} className="mx-auto text-slate-300 mb-4" />
                <p className="text-slate-500 font-medium">No data collected yet.</p>
                <p className="text-sm text-slate-400">Switch to "Enter Data" to start building your dataset.</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-600">
                    <thead className="bg-slate-50 text-slate-700 uppercase font-bold text-xs border-b border-slate-200">
                      <tr>
                        <th className="px-6 py-4">Image</th>
                        <th className="px-6 py-4">Annotations</th>
                        <th className="px-6 py-4">Q&A Details</th>
                        <th className="px-6 py-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {entries.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4 align-top">
                            <div className="w-24 h-24 rounded-lg border border-slate-200 overflow-hidden bg-slate-100">
                              <img src={item.imageUrl} className="w-full h-full object-contain" alt="Data sample" />
                            </div>
                            <div className="mt-2 text-[10px] font-bold bg-indigo-50 text-indigo-700 px-2 py-1 rounded-full inline-block border border-indigo-100">
                              {item.grade}
                            </div>
                          </td>
                          <td className="px-6 py-4 align-top max-w-md font-sinhala">
                            <div className="mb-3">
                              <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block mb-1">Correct</span>
                              <p className="text-slate-800 leading-relaxed">{item.related}</p>
                            </div>
                            <div>
                              <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider block mb-1">Distractor</span>
                              <p className="text-slate-800 leading-relaxed bg-rose-50 p-1.5 rounded border border-rose-100">{item.unrelated}</p>
                            </div>
                          </td>
                          <td className="px-6 py-4 align-top">
                            <div className="mb-3">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Question</span>
                              <p className="text-slate-900 font-medium font-sinhala">{item.question}</p>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {item.keywords && item.keywords.map((k, i) => (
                                <span key={i} className="bg-slate-100 px-2 py-1 rounded text-xs border border-slate-200 text-slate-500">
                                  {k}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right align-top">
                            <button
                              onClick={() => handleDelete(item.id)}
                              className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-2 rounded-full transition-all"
                              title="Delete Entry"
                            >
                              <Trash2 size={18} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}