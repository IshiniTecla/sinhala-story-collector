import React, { useState, useEffect } from 'react';
import {
  Camera, Save, Database, Trash2, FileText,
  CheckCircle, BookOpen, FileSpreadsheet, Code,
  Loader2, AlertCircle
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import {
  getFirestore, collection, addDoc, deleteDoc, doc,
  onSnapshot, query, orderBy, serverTimestamp
} from 'firebase/firestore';
import { getAnalytics } from "firebase/analytics";

// --- FIREBASE CONFIGURATION ---
const firebaseConfig = {
  apiKey: "AIzaSyB4ScQvL5q_9Dg8Hs5NYDNFF_fZkWfOjus",
  authDomain: "sinhala-story-collection.firebaseapp.com",
  projectId: "sinhala-story-collection",
  storageBucket: "sinhala-story-collection.firebasestorage.app",
  messagingSenderId: "101075648766",
  appId: "1:101075648766:web:acbead5d54ddc063ad25af",
  measurementId: "G-FL0X8DVWEN"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);

const COLLECTION_NAME = 'sinhala_story_dataset_simple';

export default function SimpleDataCollector() {
  const [user, setUser] = useState(null);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('collect');

  // --- SIMPLIFIED STATE ---
  const [formData, setFormData] = useState({
    grade: 'Grade 1',
    related: ''
  });

  const [imageBase64, setImageBase64] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState(null);

  // --- 1. Authentication ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          const { signInWithCustomToken } = await import('firebase/auth');
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Auth Error:", error);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsubscribe();
  }, []);

  // --- 2. Real-time Data Sync ---
  useEffect(() => {
    // Note: We attempt to fetch even if user is null, 
    // but Firestore security rules might block it if auth is required.
    const collectionPath = typeof __app_id !== 'undefined'
      ? `artifacts/${__app_id}/public/data/${COLLECTION_NAME}`
      : COLLECTION_NAME;

    const q = query(collection(db, collectionPath), orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setEntries(data);
      setLoading(false);
    }, (error) => {
      console.log("Listen error (likely permission or network):", error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user]); // Re-run when user status changes

  // Helper: Toast Notifications
  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // Helper: Image Upload
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 800 * 1024) {
      showNotification("Image too large! Keep under 800KB.", "error");
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => setImageBase64(reader.result);
    reader.readAsDataURL(file);
  };

  // --- 3. Submit Data (FIXED) ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!imageBase64) return showNotification("Please upload an image.", "error");

    setIsSubmitting(true);
    try {
      const collectionPath = typeof __app_id !== 'undefined'
        ? `artifacts/${__app_id}/public/data/${COLLECTION_NAME}`
        : COLLECTION_NAME;

      await addDoc(collection(db, collectionPath), {
        ...formData,
        imageUrl: imageBase64,
        createdAt: serverTimestamp(),
        // FIX: Ensure this is 'null' if undefined, otherwise Firestore crashes
        authorId: user?.uid || null
      });

      showNotification("Saved successfully!");
      setFormData({ grade: 'Grade 1', related: '' }); // Reset form
      setImageBase64(null);
    } catch (error) {
      console.error("Detailed Save Error:", error);
      showNotification("Save failed. Check console.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- 4. Delete ---
  const handleDelete = async (id) => {
    if (!confirm("Delete this entry?")) return;
    try {
      const collectionPath = typeof __app_id !== 'undefined'
        ? `artifacts/${__app_id}/public/data/${COLLECTION_NAME}`
        : COLLECTION_NAME;
      await deleteDoc(doc(db, collectionPath, id));
      showNotification("Deleted.", "success");
    } catch (err) { showNotification("Error deleting.", "error"); }
  };

  // --- 5. Export Logic ---
  const handleExportJSON = () => {
    const exportData = entries.map(e => ({
      input: { image_context: "Image provided separately", grade_level: e.grade },
      output: { sentence: e.related }
    }));
    const jsonString = `data:text/json;chatset=utf-8,${encodeURIComponent(JSON.stringify(exportData, null, 2))}`;
    const link = document.createElement("a");
    link.href = jsonString;
    link.download = "sinhala_sentence_training.json";
    link.click();
  };

  const handleExportCSV = () => {
    const headers = ["ID", "Grade", "Sentence", "Image_Base64"];
    const rows = entries.map(e => [
      e.id, e.grade, `"${e.related}"`, `"${e.imageUrl ? e.imageUrl.substring(0, 50) + '...' : 'No Image'}"`
    ]);
    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "dataset_simple.csv";
    link.click();
  };

  return (
    <div className="min-h-screen font-sans text-slate-800 pb-10 bg-slate-50">
      {/* Header */}
      <nav className="bg-indigo-700 text-white shadow-md sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BookOpen className="text-indigo-200" size={24} />
            <div>
              <h1 className="font-bold text-lg leading-tight">Sinhala Image-Story Collector</h1>
              <p className="text-xs text-indigo-200">Simplified Data Entry</p>
            </div>
          </div>
          <div className="flex bg-indigo-800/50 p-1 rounded-lg">
            <button onClick={() => setActiveTab('collect')} className={`px-4 py-1.5 rounded text-sm font-medium transition-all ${activeTab === 'collect' ? 'bg-white text-indigo-800 shadow-sm' : 'text-indigo-100 hover:text-white'}`}>
              Data Entry
            </button>
            <button onClick={() => setActiveTab('dataset')} className={`px-4 py-1.5 rounded text-sm font-medium transition-all ${activeTab === 'dataset' ? 'bg-white text-indigo-800 shadow-sm' : 'text-indigo-100 hover:text-white'}`}>
              View Set ({entries.length})
            </button>
          </div>
        </div>
      </nav>

      {/* Notifications */}
      {notification && (
        <div className={`fixed top-20 right-5 px-6 py-4 rounded-lg shadow-xl text-white z-50 animate-fade-in ${notification.type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'}`}>
          <div className="flex items-center gap-3">
            {notification.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
            <p className="font-medium">{notification.message}</p>
          </div>
        </div>
      )}

      <main className="max-w-6xl mx-auto px-4 py-8">
        {activeTab === 'collect' ? (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
            {/* Image Section */}
            <div className="md:col-span-5 space-y-4">
              <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 h-full">
                <h2 className="font-semibold mb-4 text-slate-700 flex items-center gap-2">
                  <Camera size={18} /> 1. Upload Image
                </h2>
                <div className={`border-2 border-dashed rounded-xl h-64 flex flex-col justify-center items-center transition-all ${imageBase64 ? 'border-indigo-300 bg-indigo-50' : 'border-slate-300 hover:bg-slate-50'}`}>
                  {imageBase64 ? (
                    <div className="relative w-full h-full p-2">
                      <img src={imageBase64} alt="Preview" className="w-full h-full object-contain rounded" />
                      <button onClick={() => setImageBase64(null)} className="absolute top-2 right-2 bg-white p-2 rounded-full text-rose-500 shadow hover:scale-110 transition-transform">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ) : (
                    <label className="cursor-pointer w-full h-full flex flex-col items-center justify-center">
                      <Camera className="text-indigo-300 mb-2" size={32} />
                      <span className="text-sm font-medium text-slate-600">Click to Upload</span>
                      <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                    </label>
                  )}
                </div>

                <div className="mt-6">
                  <label className="text-xs font-bold text-slate-500 uppercase">Target Grade</label>
                  <select
                    value={formData.grade}
                    onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
                    className="w-full mt-1 p-2.5 border rounded-lg bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option>Grade 1</option>
                    <option>Grade 2</option>
                    <option>Grade 3</option>
                    <option>Grade 4</option>
                    <option>Grade 5</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Form Section */}
            <div className="md:col-span-7">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-full flex flex-col justify-between">
                <div>
                  <h2 className="font-semibold mb-6 text-slate-700 flex items-center gap-2">
                    <FileText size={18} /> 2. Write Sentence
                  </h2>
                  <form onSubmit={handleSubmit} className="space-y-5">
                    {/* Correct Sentence ONLY */}
                    <div className="bg-emerald-50/50 p-5 rounded-lg border border-emerald-100">
                      <label className="text-sm font-bold text-emerald-800 mb-3 flex items-center gap-2">
                        <CheckCircle size={16} /> Correct Sentence (Spoken Sinhala)
                      </label>
                      <textarea
                        required rows={6}
                        placeholder="Type the correct story sentence here...&#10;Ex: ළමයි වතුරේ සෙල්ලම් කරනවා."
                        className="w-full p-4 rounded border border-emerald-200 focus:ring-2 focus:ring-emerald-500 outline-none text-lg font-sinhala leading-relaxed"
                        value={formData.related}
                        onChange={(e) => setFormData({ ...formData, related: e.target.value })}
                      />
                    </div>
                  </form>
                </div>

                <div className="pt-4 flex justify-end">
                  <button onClick={handleSubmit} disabled={isSubmitting} className="w-full bg-indigo-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-200">
                    {isSubmitting ? <Loader2 className="animate-spin" /> : <Save size={20} />}
                    {isSubmitting ? 'Saving...' : 'Save Entry'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Dataset View */
          <div className="space-y-6">
            <div className="flex justify-between items-center bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <div>
                <h2 className="font-bold text-lg text-slate-800">Collected Data</h2>
                <p className="text-slate-500 text-sm">Review your Image-Sentence pairs.</p>
              </div>
              <div className="flex gap-3">
                <button onClick={handleExportCSV} className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700 font-medium text-sm transition-colors">
                  <FileSpreadsheet size={16} className="text-emerald-600" /> Export CSV
                </button>
                <button onClick={handleExportJSON} className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-black font-medium text-sm transition-colors shadow-md">
                  <Code size={16} className="text-yellow-400" /> Export JSON
                </button>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase font-bold text-slate-500">
                  <tr>
                    <th className="px-6 py-4">Image</th>
                    <th className="px-6 py-4">Correct Sentence</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr><td colSpan="3" className="p-8 text-center"><Loader2 className="animate-spin mx-auto text-indigo-500" />Syncing...</td></tr>
                  ) : entries.map(item => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 w-32 align-top">
                        <img src={item.imageUrl} className="w-24 h-24 object-cover rounded border border-slate-200 bg-slate-100" />
                        <div className="mt-2 text-[10px] font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded text-center">{item.grade}</div>
                      </td>
                      <td className="px-6 py-4 align-top">
                        <p className="text-lg font-sinhala text-slate-800 leading-relaxed p-2 bg-slate-50 rounded border border-slate-100">
                          {item.related}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-right align-top">
                        <button onClick={() => handleDelete(item.id)} className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-2 rounded-full">
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
      </main>
    </div>
  );
}