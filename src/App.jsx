import React, { useState, useEffect } from 'react';
import {
  Camera, Save, Database, Trash2, FileText,
  CheckCircle, BookOpen, FileSpreadsheet, Code,
  Loader2, AlertCircle, List, HelpCircle
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

// Updated collection name to separate this advanced dataset from the simple one
const COLLECTION_NAME = 'sinhala_story_dataset_gold';

export default function GoldenDataCollector() {
  const [user, setUser] = useState(null);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('collect');

  // --- UPDATED STATE FOR GOLDEN DATASET ---
  const [formData, setFormData] = useState({
    grade: 'Grade 1',
    theme: '',
    keywords: '', // Comma separated string
    storySentences: '', // Newline separated string
    unrelatedSentences: '', // Newline separated string
    questions: [
      { id: 'q1', question: '', options: ['', '', ''], correctIndex: 0 },
      { id: 'q2', question: '', options: ['', '', ''], correctIndex: 0 },
      { id: 'q3', question: '', options: ['', '', ''], correctIndex: 0 }
    ]
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
    const collectionPath = typeof __app_id !== 'undefined'
      ? `artifacts/${__app_id}/public/data/${COLLECTION_NAME}`
      : COLLECTION_NAME;

    const q = query(collection(db, collectionPath), orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setEntries(data);
      setLoading(false);
    }, (error) => {
      console.log("Listen error:", error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

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

  // Helper: Update Question State
  const updateQuestion = (index, field, value, optIndex = null) => {
    const newQuestions = [...formData.questions];
    if (field === 'options' && optIndex !== null) {
      newQuestions[index].options[optIndex] = value;
    } else {
      newQuestions[index][field] = value;
    }
    setFormData({ ...formData, questions: newQuestions });
  };

  // --- 3. Submit Data ---
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
        authorId: user?.uid || null
      });

      showNotification("Dataset entry saved!");

      // Reset Form
      setFormData({
        grade: 'Grade 1',
        theme: '',
        keywords: '',
        storySentences: '',
        unrelatedSentences: '',
        questions: [
          { id: 'q1', question: '', options: ['', '', ''], correctIndex: 0 },
          { id: 'q2', question: '', options: ['', '', ''], correctIndex: 0 },
          { id: 'q3', question: '', options: ['', '', ''], correctIndex: 0 }
        ]
      });
      setImageBase64(null);
    } catch (error) {
      console.error("Save Error:", error);
      showNotification("Save failed.", "error");
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

  // --- 5. Export Logic (UPDATED FOR GOLDEN DATASET) ---
  const handleExportJSON = () => {
    const exportData = entries.map(e => ({
      grade: parseInt(e.grade.replace('Grade ', '')),
      theme: e.theme || "General",
      keywords: e.keywords ? e.keywords.split(',').map(k => k.trim()) : [],
      perfect_response: {
        story_sentences: e.storySentences.split('\n').filter(s => s.trim()),
        unrelated_sentences: e.unrelatedSentences.split('\n').filter(s => s.trim()),
        questions: {
          q1: {
            question: e.questions[0].question,
            answers: e.questions[0].options,
            correct_answer: e.questions[0].options[e.questions[0].correctIndex]
          },
          q2: {
            question: e.questions[1].question,
            answers: e.questions[1].options,
            correct_answer: e.questions[1].options[e.questions[1].correctIndex]
          },
          q3: {
            question: e.questions[2].question,
            answers: e.questions[2].options,
            correct_answer: e.questions[2].options[e.questions[2].correctIndex]
          }
        }
      }
    }));

    const jsonString = `data:text/json;chatset=utf-8,${encodeURIComponent(JSON.stringify(exportData, null, 2))}`;
    const link = document.createElement("a");
    link.href = jsonString;
    link.download = "dataset.json"; // Matches the filename needed for your Python script
    link.click();
  };

  const handleExportCSV = () => {
    // Simple CSV export for summary
    const headers = ["ID", "Grade", "Theme", "Keywords", "Story_Preview"];
    const rows = entries.map(e => [
      e.id,
      e.grade,
      `"${e.theme}"`,
      `"${e.keywords}"`,
      `"${e.storySentences.substring(0, 50).replace(/\n/g, ' ')}..."`
    ]);
    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "dataset_summary.csv";
    link.click();
  };

  return (
    <div className="min-h-screen font-sans text-slate-800 pb-10 bg-slate-50">
      {/* Header */}
      <nav className="bg-emerald-700 text-white shadow-md sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BookOpen className="text-emerald-200" size={24} />
            <div>
              <h1 className="font-bold text-lg leading-tight">Golden Dataset Creator</h1>
              <p className="text-xs text-emerald-200">Few-Shot Learning Tool</p>
            </div>
          </div>
          <div className="flex bg-emerald-800/50 p-1 rounded-lg">
            <button onClick={() => setActiveTab('collect')} className={`px-4 py-1.5 rounded text-sm font-medium transition-all ${activeTab === 'collect' ? 'bg-white text-emerald-800 shadow-sm' : 'text-emerald-100 hover:text-white'}`}>
              Editor
            </button>
            <button onClick={() => setActiveTab('dataset')} className={`px-4 py-1.5 rounded text-sm font-medium transition-all ${activeTab === 'dataset' ? 'bg-white text-emerald-800 shadow-sm' : 'text-emerald-100 hover:text-white'}`}>
              View Data ({entries.length})
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

            {/* LEFT COLUMN: Image & Context */}
            <div className="md:col-span-4 space-y-4">
              <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                <h2 className="font-semibold mb-4 text-slate-700 flex items-center gap-2">
                  <Camera size={18} /> 1. Upload Image
                </h2>
                <div className={`border-2 border-dashed rounded-xl h-48 flex flex-col justify-center items-center transition-all ${imageBase64 ? 'border-emerald-300 bg-emerald-50' : 'border-slate-300 hover:bg-slate-50'}`}>
                  {imageBase64 ? (
                    <div className="relative w-full h-full p-2">
                      <img src={imageBase64} alt="Preview" className="w-full h-full object-contain rounded" />
                      <button onClick={() => setImageBase64(null)} className="absolute top-2 right-2 bg-white p-2 rounded-full text-rose-500 shadow hover:scale-110 transition-transform">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ) : (
                    <label className="cursor-pointer w-full h-full flex flex-col items-center justify-center">
                      <Camera className="text-emerald-300 mb-2" size={32} />
                      <span className="text-sm font-medium text-slate-600">Click to Upload</span>
                      <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                    </label>
                  )}
                </div>
              </div>

              <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 space-y-4">
                <h2 className="font-semibold text-slate-700 flex items-center gap-2">
                  <List size={18} /> 2. Story Context
                </h2>

                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase">Target Grade</label>
                  <select
                    value={formData.grade}
                    onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
                    className="w-full mt-1 p-2.5 border rounded-lg bg-slate-50 outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {[1, 2, 3, 4, 5].map(g => <option key={g} value={`Grade ${g}`}>Grade {g}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase">Theme (Sinhala)</label>
                  <input
                    type="text"
                    placeholder="Ex: සතුන්ගේ මිතුරුකම"
                    className="w-full mt-1 p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 font-sinhala"
                    value={formData.theme}
                    onChange={(e) => setFormData({ ...formData, theme: e.target.value })}
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase">Keywords (Comma Separated)</label>
                  <input
                    type="text"
                    placeholder="Ex: හරක්, තණකොළ, ගොවිපල"
                    className="w-full mt-1 p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 font-sinhala"
                    value={formData.keywords}
                    onChange={(e) => setFormData({ ...formData, keywords: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: Content & Questions */}
            <div className="md:col-span-8">
              <form onSubmit={handleSubmit} className="space-y-6">

                {/* Story Content */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                  <h2 className="font-semibold mb-4 text-slate-700 flex items-center gap-2">
                    <FileText size={18} /> 3. Perfect Story Content
                  </h2>

                  <div className="grid grid-cols-1 gap-6">
                    <div>
                      <label className="text-sm font-bold text-slate-600 mb-2 block">
                        Story Sentences (Separate by New Line)
                      </label>
                      <textarea
                        required rows={6}
                        placeholder="Write the perfect story here..."
                        className="w-full p-4 rounded border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none font-sinhala leading-relaxed"
                        value={formData.storySentences}
                        onChange={(e) => setFormData({ ...formData, storySentences: e.target.value })}
                      />
                    </div>

                    <div>
                      <label className="text-sm font-bold text-slate-600 mb-2 block">
                        Unrelated Sentences (Separate by New Line)
                      </label>
                      <textarea
                        required rows={3}
                        placeholder="Write 2 unrelated sentences here..."
                        className="w-full p-4 rounded border border-slate-200 focus:ring-2 focus:ring-rose-200 outline-none font-sinhala leading-relaxed bg-rose-50/30"
                        value={formData.unrelatedSentences}
                        onChange={(e) => setFormData({ ...formData, unrelatedSentences: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                {/* MCQs */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                  <h2 className="font-semibold mb-6 text-slate-700 flex items-center gap-2">
                    <HelpCircle size={18} /> 4. Multiple Choice Questions
                  </h2>

                  <div className="space-y-8">
                    {formData.questions.map((q, qIndex) => (
                      <div key={q.id} className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                        <h3 className="text-xs font-bold text-slate-400 uppercase mb-3">Question {qIndex + 1}</h3>

                        <div className="space-y-3">
                          <input
                            type="text"
                            placeholder="Question in Sinhala"
                            className="w-full p-2 border rounded outline-none focus:border-emerald-500 font-sinhala"
                            value={q.question}
                            onChange={(e) => updateQuestion(qIndex, 'question', e.target.value)}
                          />

                          <div className="grid grid-cols-3 gap-2">
                            {q.options.map((opt, optIndex) => (
                              <input
                                key={optIndex}
                                type="text"
                                placeholder={`Option ${optIndex + 1}`}
                                className="w-full p-2 border rounded outline-none focus:border-emerald-500 font-sinhala text-sm"
                                value={opt}
                                onChange={(e) => updateQuestion(qIndex, 'options', e.target.value, optIndex)}
                              />
                            ))}
                          </div>

                          <div className="flex items-center gap-3 mt-2">
                            <span className="text-sm font-medium text-slate-600">Correct Answer:</span>
                            <div className="flex gap-4">
                              {[0, 1, 2].map((idx) => (
                                <label key={idx} className="flex items-center gap-1 cursor-pointer">
                                  <input
                                    type="radio"
                                    name={`correct-${q.id}`}
                                    checked={q.correctIndex === idx}
                                    onChange={() => updateQuestion(qIndex, 'correctIndex', idx)}
                                    className="text-emerald-600 focus:ring-emerald-500"
                                  />
                                  <span className="text-sm">Opt {idx + 1}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Submit Button */}
                <div className="pt-2">
                  <button onClick={handleSubmit} disabled={isSubmitting} className="w-full bg-emerald-600 text-white px-8 py-4 rounded-xl font-bold hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-200 text-lg">
                    {isSubmitting ? <Loader2 className="animate-spin" /> : <Save size={24} />}
                    {isSubmitting ? 'Saving Dataset Entry...' : 'Save Golden Entry'}
                  </button>
                </div>

              </form>
            </div>
          </div>
        ) : (
          /* Dataset View */
          <div className="space-y-6">
            <div className="flex justify-between items-center bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <div>
                <h2 className="font-bold text-lg text-slate-800">Golden Dataset Entries</h2>
                <p className="text-slate-500 text-sm">Download this as JSON for your Python script.</p>
              </div>
              <div className="flex gap-3">
                <button onClick={handleExportCSV} className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700 font-medium text-sm transition-colors">
                  <FileSpreadsheet size={16} className="text-emerald-600" /> Export CSV
                </button>
                <button onClick={handleExportJSON} className="flex items-center gap-2 px-6 py-2 bg-emerald-900 text-white rounded-lg hover:bg-black font-medium text-sm transition-colors shadow-md">
                  <Code size={16} className="text-yellow-400" /> Export JSON
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {loading ? (
                <div className="text-center p-10"><Loader2 className="animate-spin mx-auto text-emerald-500" /></div>
              ) : entries.map(item => (
                <div key={item.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex gap-6 hover:shadow-md transition-shadow">
                  <div className="w-24 h-24 shrink-0">
                    <img src={item.imageUrl} className="w-full h-full object-cover rounded bg-slate-100" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 mb-2">
                          {item.grade}
                        </span>
                        <h3 className="font-bold text-slate-800 font-sinhala text-lg">{item.theme || "No Theme"}</h3>
                        <p className="text-xs text-slate-500 mt-1">Keywords: {item.keywords}</p>
                      </div>
                      <button onClick={() => handleDelete(item.id)} className="text-slate-400 hover:text-rose-600 p-2">
                        <Trash2 size={18} />
                      </button>
                    </div>
                    <p className="mt-3 text-sm text-slate-600 font-sinhala line-clamp-2">
                      {item.storySentences.replace(/\n/g, ' ')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}