import React, { useState, useEffect } from 'react';
import {
  Camera, Save, Trash2, FileText,
  CheckCircle, BookOpen, FileSpreadsheet, Code,
  Loader2, AlertCircle, List, HelpCircle, Terminal, Edit2, Download
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import {
  getFirestore, collection, addDoc, deleteDoc, updateDoc, doc,
  onSnapshot, query, orderBy, serverTimestamp
} from 'firebase/firestore';

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

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const COLLECTION_NAME = 'sinhala_story_dataset_gold';

export default function GoldenDataCollector() {
  const [user, setUser] = useState(null);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('collect');

  // New State for Editing
  const [editingId, setEditingId] = useState(null);

  const [formData, setFormData] = useState({
    grade: 'Grade 1-2 (Beginner)',
    theme: '',
    keywords: '',
    storySentences: '',
    unrelatedSentences: '',
    questions: [
      { id: 'q1', question: '', options: ['', '', ''], correctIndex: 0 },
      { id: 'q2', question: '', options: ['', '', ''], correctIndex: 0 },
    ]
  });

  const [imageBase64, setImageBase64] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState(null);

  // --- Auth & Sync ---
  useEffect(() => {
    signInAnonymously(auth).catch(console.error);
    onAuthStateChanged(auth, setUser);
  }, []);

  useEffect(() => {
    const q = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setEntries(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // --- HELPER: Categorize Data for View ---
  const getCategory = (gradeString) => {
    const g = gradeString || "";
    if (g.includes("1") || g.includes("2")) return "beginner";
    if (g.includes("3") || g.includes("4")) return "intermediate";
    if (g.includes("5")) return "advanced";
    return "beginner"; // Fallback
  };

  const beginnerEntries = entries.filter(e => getCategory(e.grade) === "beginner");
  const intermediateEntries = entries.filter(e => getCategory(e.grade) === "intermediate");
  const advancedEntries = entries.filter(e => getCategory(e.grade) === "advanced");

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setImageBase64(reader.result);
    reader.readAsDataURL(file);
  };

  const updateQuestion = (index, field, value, optIndex = null) => {
    const newQuestions = [...formData.questions];
    if (field === 'options' && optIndex !== null) {
      newQuestions[index].options[optIndex] = value;
    } else {
      newQuestions[index][field] = value;
    }
    setFormData({ ...formData, questions: newQuestions });
  };

  // --- EDIT FUNCTION ---
  const handleEdit = (item) => {
    setFormData({
      grade: item.grade,
      theme: item.theme || '',
      keywords: item.keywords,
      storySentences: item.storySentences,
      unrelatedSentences: item.unrelatedSentences,
      questions: item.questions
    });
    setImageBase64(item.imageUrl);
    setEditingId(item.id);
    setActiveTab('collect');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    showNotification("Loaded for editing. Make changes and click Update.", "success");
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setFormData({
      grade: 'Grade 1-2 (Beginner)',
      theme: '',
      keywords: '',
      storySentences: '',
      unrelatedSentences: '',
      questions: [
        { id: 'q1', question: '', options: ['', '', ''], correctIndex: 0 },
        { id: 'q2', question: '', options: ['', '', ''], correctIndex: 0 },
      ]
    });
    setImageBase64(null);
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!imageBase64) return showNotification("Please upload an image.", "error");

    setIsSubmitting(true);
    try {
      if (editingId) {
        // --- UPDATE EXISTING ---
        const docRef = doc(db, COLLECTION_NAME, editingId);
        await updateDoc(docRef, {
          ...formData,
          imageUrl: imageBase64,
        });
        showNotification("Entry Updated Successfully!");
      } else {
        // --- CREATE NEW ---
        await addDoc(collection(db, COLLECTION_NAME), {
          ...formData,
          imageUrl: imageBase64,
          createdAt: serverTimestamp(),
          authorId: user?.uid || null
        });
        showNotification("Saved! Great job.");
      }

      handleCancelEdit();

    } catch (error) {
      console.error(error);
      showNotification("Save failed.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (confirm("Delete this entry?")) {
      await deleteDoc(doc(db, COLLECTION_NAME, id));
    }
  };

  // ==========================================================
  // EXPORT FUNCTION (Now accepts specific data)
  // ==========================================================
  const exportData = (dataToExport, filename) => {
    if (dataToExport.length === 0) {
      showNotification("No data to export in this category.", "error");
      return;
    }

    const jsonlData = dataToExport.map(e => {
      const storyText = e.storySentences.replace(/\n/g, ' ').trim();
      let questionsText = "ප්‍රශ්න:\n";
      e.questions.forEach((q, idx) => {
        questionsText += `${idx + 1}. ${q.question}\n`;
      });
      let answersText = "පිළිතුරු:\n";
      e.questions.forEach((q, idx) => {
        const correctOpt = q.options[q.correctIndex];
        answersText += `${idx + 1}. ${correctOpt}\n`;
      });
      const fullOutput = `කතාව:\n${storyText}\n\n${questionsText}\n${answersText}`;

      return JSON.stringify({
        instruction: `Write a spoken Sinhala story for ${e.grade} and questions based on: ${e.keywords}`,
        input: `keywords: ${e.keywords}`,
        output: fullOutput
      });
    });

    const blob = new Blob([jsonlData.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
  };

  return (
    <div className="min-h-screen font-sans text-slate-800 pb-10 bg-slate-50">
      <nav className="bg-purple-700 text-white shadow-md sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BookOpen className="text-purple-200" size={24} />
            <div>
              <h1 className="font-bold text-lg leading-tight">SinLama Data Creator</h1>
              <p className="text-xs text-purple-200">Gamified Dataset Tool</p>
            </div>
          </div>
          <div className="flex bg-purple-800/50 p-1 rounded-lg">
            <button onClick={() => setActiveTab('collect')} className={`px-4 py-1.5 rounded text-sm font-medium transition-all ${activeTab === 'collect' ? 'bg-white text-purple-800' : 'text-purple-100'}`}>Editor</button>
            <button onClick={() => setActiveTab('dataset')} className={`px-4 py-1.5 rounded text-sm font-medium transition-all ${activeTab === 'dataset' ? 'bg-white text-purple-800' : 'text-purple-100'}`}>View Data ({entries.length})</button>
          </div>
        </div>
      </nav>

      {notification && (
        <div className={`fixed top-20 right-5 px-6 py-4 rounded-lg shadow-xl text-white z-50 ${notification.type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'}`}>
          <div className="flex items-center gap-3">
            <CheckCircle size={20} />
            <p className="font-medium">{notification.message}</p>
          </div>
        </div>
      )}

      <main className="max-w-6xl mx-auto px-4 py-8">
        {activeTab === 'collect' ? (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
            {/* LEFT COLUMN: Context */}
            <div className="md:col-span-4 space-y-4">
              <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                <h2 className="font-semibold mb-4 text-slate-700 flex items-center gap-2"><Camera size={18} /> Image Upload</h2>
                <div className={`border-2 border-dashed rounded-xl h-48 flex flex-col justify-center items-center ${imageBase64 ? 'border-purple-300 bg-purple-50' : 'border-slate-300'}`}>
                  {imageBase64 ? (
                    <div className="relative w-full h-full p-2">
                      <img src={imageBase64} alt="Preview" className="w-full h-full object-contain rounded" />
                      <button onClick={() => setImageBase64(null)} className="absolute top-2 right-2 bg-white p-2 rounded-full text-rose-500 shadow"><Trash2 size={16} /></button>
                    </div>
                  ) : (
                    <label className="cursor-pointer w-full h-full flex flex-col items-center justify-center">
                      <Camera className="text-purple-300 mb-2" size={32} />
                      <span className="text-sm font-medium text-slate-600">Click to Upload</span>
                      <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                    </label>
                  )}
                </div>
              </div>

              <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 space-y-4">
                <div className="flex justify-between items-center">
                  <h2 className="font-semibold text-slate-700 flex items-center gap-2"><List size={18} /> Context</h2>
                  {editingId && <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded font-bold">EDITING MODE</span>}
                </div>

                {/* 1. Theme */}
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase">Theme Name (Sinhala)</label>
                  <input type="text" placeholder="Ex: කෑම උයන වලහා" className="w-full mt-1 p-2.5 border rounded-lg font-sinhala" value={formData.theme} onChange={(e) => setFormData({ ...formData, theme: e.target.value })} />
                </div>

                {/* 2. Grade Selector */}
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase">Difficulty Level</label>
                  <select
                    value={formData.grade}
                    onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
                    className="w-full mt-1 p-2.5 border rounded-lg bg-slate-50 focus:ring-2 focus:ring-purple-500 outline-none"
                  >
                    <option value="Grade 1-2 (Beginner)">Grade 1-2 (Beginner)</option>
                    <option value="Grade 3-4 (Intermediate)">Grade 3-4 (Intermediate)</option>
                    <option value="Grade 5 (Advanced)">Grade 5 (Advanced)</option>
                  </select>
                </div>

                {/* 3. Keywords */}
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase">Keywords (Paste English BLIP)</label>
                  <input type="text" placeholder="Paste the English sentence here..." className="w-full mt-1 p-2.5 border rounded-lg bg-yellow-50" value={formData.keywords} onChange={(e) => setFormData({ ...formData, keywords: e.target.value })} />
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: Content */}
            <div className="md:col-span-8">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                  <h2 className="font-semibold mb-4 text-slate-700 flex items-center gap-2"><FileText size={18} /> Story Content</h2>
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-bold text-slate-400 uppercase">Correct Story Sentences</label>
                      <textarea required rows={5} placeholder="Write the perfect Sinhala story here (sentences on new lines)..." className="w-full mt-1 p-4 rounded border font-sinhala focus:ring-2 focus:ring-purple-500 outline-none" value={formData.storySentences} onChange={(e) => setFormData({ ...formData, storySentences: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-400 uppercase">Distractor Sentences (Wrong)</label>
                      <textarea required rows={3} placeholder="Write 2 unrelated sentences..." className="w-full mt-1 p-4 rounded border bg-rose-50 font-sinhala focus:ring-2 focus:ring-rose-500 outline-none" value={formData.unrelatedSentences} onChange={(e) => setFormData({ ...formData, unrelatedSentences: e.target.value })} />
                    </div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                  <h2 className="font-semibold mb-6 text-slate-700 flex items-center gap-2"><HelpCircle size={18} /> Quiz Questions</h2>
                  <div className="space-y-6">
                    {formData.questions.map((q, qIndex) => (
                      <div key={q.id} className="p-4 bg-slate-50 rounded-lg border">
                        <input type="text" placeholder={`Question ${qIndex + 1}`} className="w-full p-2 border rounded font-sinhala mb-2" value={q.question} onChange={(e) => updateQuestion(qIndex, 'question', e.target.value)} />
                        <div className="grid grid-cols-3 gap-2">
                          {q.options.map((opt, optIndex) => (
                            <input key={optIndex} type="text" placeholder={`Option ${optIndex + 1}`} className="w-full p-2 border rounded font-sinhala text-sm" value={opt} onChange={(e) => updateQuestion(qIndex, 'options', e.target.value, optIndex)} />
                          ))}
                        </div>
                        <div className="flex gap-4 mt-2">
                          {[0, 1, 2].map((idx) => (
                            <label key={idx} className="flex items-center gap-1 cursor-pointer"><input type="radio" name={`correct-${q.id}`} checked={q.correctIndex === idx} onChange={() => updateQuestion(qIndex, 'correctIndex', idx)} /><span className="text-sm">Opt {idx + 1} Correct</span></label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3">
                  {editingId && (
                    <button type="button" onClick={handleCancelEdit} className="w-1/3 bg-slate-200 text-slate-700 px-8 py-4 rounded-xl font-bold hover:bg-slate-300 transition-all">
                      Cancel
                    </button>
                  )}
                  <button disabled={isSubmitting} className={`flex-1 ${editingId ? 'bg-yellow-500 hover:bg-yellow-600' : 'bg-purple-600 hover:bg-purple-700'} text-white px-8 py-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2`}>
                    {isSubmitting ? <Loader2 className="animate-spin" /> : (editingId ? <Edit2 size={24} /> : <Save size={24} />)}
                    {isSubmitting ? 'Saving...' : (editingId ? 'Update Entry' : 'Save to Dataset')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="flex justify-between items-center bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <div>
                <h2 className="font-bold text-lg text-slate-800">Dataset Overview</h2>
                <p className="text-slate-500 text-sm">Download categories separately or all at once.</p>
              </div>
              <button onClick={() => exportData(entries, 'train_full.jsonl')} className="flex items-center gap-2 px-6 py-2 bg-black text-white rounded-lg hover:bg-slate-800 font-bold transition-colors shadow-md">
                <Terminal size={18} className="text-green-400" /> Download ALL ({entries.length})
              </button>
            </div>

            {/* --- SECTIONS --- */}

            {/* 1. BEGINNER */}
            <div>
              <div className="flex justify-between items-end mb-4 border-b pb-2">
                <h3 className="text-purple-700 font-bold text-xl flex items-center gap-2">🌱 Beginner (Grade 1-2)</h3>
                <button onClick={() => exportData(beginnerEntries, 'train_beginner.jsonl')} className="text-xs bg-purple-100 text-purple-700 px-3 py-1.5 rounded font-bold hover:bg-purple-200 flex gap-1">
                  <Download size={14} /> Download Only These ({beginnerEntries.length})
                </button>
              </div>
              <div className="grid grid-cols-1 gap-4">
                {beginnerEntries.length === 0 && <p className="text-slate-400 italic pl-4">No entries yet.</p>}
                {beginnerEntries.map(item => <EntryCard key={item.id} item={item} onEdit={handleEdit} onDelete={handleDelete} />)}
              </div>
            </div>

            {/* 2. INTERMEDIATE */}
            <div>
              <div className="flex justify-between items-end mb-4 mt-8 border-b pb-2">
                <h3 className="text-blue-600 font-bold text-xl flex items-center gap-2">📘 Intermediate (Grade 3-4)</h3>
                <button onClick={() => exportData(intermediateEntries, 'train_intermediate.jsonl')} className="text-xs bg-blue-100 text-blue-700 px-3 py-1.5 rounded font-bold hover:bg-blue-200 flex gap-1">
                  <Download size={14} /> Download Only These ({intermediateEntries.length})
                </button>
              </div>
              <div className="grid grid-cols-1 gap-4">
                {intermediateEntries.length === 0 && <p className="text-slate-400 italic pl-4">No entries yet.</p>}
                {intermediateEntries.map(item => <EntryCard key={item.id} item={item} onEdit={handleEdit} onDelete={handleDelete} />)}
              </div>
            </div>

            {/* 3. ADVANCED */}
            <div>
              <div className="flex justify-between items-end mb-4 mt-8 border-b pb-2">
                <h3 className="text-rose-600 font-bold text-xl flex items-center gap-2">🎓 Advanced (Grade 5)</h3>
                <button onClick={() => exportData(advancedEntries, 'train_advanced.jsonl')} className="text-xs bg-rose-100 text-rose-700 px-3 py-1.5 rounded font-bold hover:bg-rose-200 flex gap-1">
                  <Download size={14} /> Download Only These ({advancedEntries.length})
                </button>
              </div>
              <div className="grid grid-cols-1 gap-4">
                {advancedEntries.length === 0 && <p className="text-slate-400 italic pl-4">No entries yet.</p>}
                {advancedEntries.map(item => <EntryCard key={item.id} item={item} onEdit={handleEdit} onDelete={handleDelete} />)}
              </div>
            </div>

          </div>
        )}
      </main>
    </div>
  );
}

// Sub-component for cleaner code
function EntryCard({ item, onEdit, onDelete }) {
  return (
    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex gap-6 hover:shadow-md transition-shadow">
      <img src={item.imageUrl} className="w-24 h-24 object-cover rounded bg-slate-100" />
      <div className="flex-1">
        <div className="flex justify-between">
          <h3 className="font-bold font-sinhala text-lg">{item.theme || "No Theme Name"}</h3>
          <div className="flex gap-2">
            <button onClick={() => onEdit(item)} className="p-2 bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200 transition-colors" title="Edit">
              <Edit2 size={16} />
            </button>
            <button onClick={() => onDelete(item.id)} className="p-2 bg-rose-100 text-rose-700 rounded-lg hover:bg-rose-200 transition-colors" title="Delete">
              <Trash2 size={16} />
            </button>
          </div>
        </div>
        <div className="flex gap-2 my-1">
          <span className="text-xs font-bold bg-slate-100 text-slate-700 px-2 py-1 rounded">{item.grade}</span>
          <span className="text-xs text-slate-500 self-center truncate max-w-md">Keywords: {item.keywords}</span>
        </div>
        <p className="mt-2 text-sm font-sinhala line-clamp-2 text-slate-600">{item.storySentences}</p>
      </div>
    </div>
  );
}