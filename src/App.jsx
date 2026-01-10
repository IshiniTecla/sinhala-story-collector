import React, { useState, useEffect } from 'react';
import {
  Camera, Save, Trash2, FileText,
  CheckCircle, BookOpen, FileSpreadsheet, Code,
  Loader2, AlertCircle, List, HelpCircle, Terminal
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import {
  getFirestore, collection, addDoc, deleteDoc, doc,
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

  const [formData, setFormData] = useState({
    grade: 'Grade 1',
    theme: '',        // <--- We need this for the List View!
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!imageBase64) return showNotification("Please upload an image.", "error");

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, COLLECTION_NAME), {
        ...formData,
        imageUrl: imageBase64,
        createdAt: serverTimestamp(),
        authorId: user?.uid || null
      });

      showNotification("Saved! Great job.");

      // Reset logic
      setFormData({
        grade: 'Grade 1',
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
  // EXPORT FOR LLAMA TRAINING
  // ==========================================================
  const handleExportTrainingData = () => {
    const jsonlData = entries.map(e => {

      // Clean up the story text (remove extra spaces)
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
        // We use the English keywords in the instruction/input
        instruction: `Write a spoken Sinhala story for ${e.grade} and questions based on: ${e.keywords}`,
        input: `keywords: ${e.keywords}`,
        output: fullOutput
      });
    });

    const blob = new Blob([jsonlData.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "train.jsonl";
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
                <h2 className="font-semibold text-slate-700 flex items-center gap-2"><List size={18} /> Context</h2>

                {/* 1. Theme (Added back for your organization) */}
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
                    <option value="Grade 1">Grade 1 - Beginner</option>
                    <option value="Grade 2">Grade 2 - Beginner</option>
                    <option value="Grade 3">Grade 3 - Intermediate</option>
                    <option value="Grade 4">Grade 4 - Intermediate</option>
                    <option value="Grade 5">Grade 5 - Advanced</option>
                  </select>
                </div>

                {/* 3. Keywords (Updated Label) */}
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

                <button disabled={isSubmitting} className="w-full bg-purple-600 text-white px-8 py-4 rounded-xl font-bold hover:bg-purple-700 transition-all flex items-center justify-center gap-2">
                  {isSubmitting ? <Loader2 className="animate-spin" /> : <Save size={24} />}
                  {isSubmitting ? 'Saving...' : 'Save to Dataset'}
                </button>
              </form>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex justify-between items-center bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <div>
                <h2 className="font-bold text-lg text-slate-800">Dataset Entries</h2>
                <p className="text-slate-500 text-sm">Download this for your Python script.</p>
              </div>
              <button onClick={handleExportTrainingData} className="flex items-center gap-2 px-6 py-2 bg-black text-white rounded-lg hover:bg-slate-800 font-bold transition-colors shadow-md">
                <Terminal size={18} className="text-green-400" /> Download train.jsonl
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {entries.map(item => (
                <div key={item.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex gap-6">
                  <img src={item.imageUrl} className="w-24 h-24 object-cover rounded bg-slate-100" />
                  <div className="flex-1">
                    <div className="flex justify-between">
                      <h3 className="font-bold font-sinhala">{item.theme || "No Theme Name"}</h3>
                      <button onClick={() => handleDelete(item.id)} className="text-rose-500"><Trash2 size={18} /></button>
                    </div>
                    <div className="flex gap-2 my-1">
                      <span className="text-xs font-bold bg-purple-100 text-purple-700 px-2 py-1 rounded">{item.grade}</span>
                      <span className="text-xs text-slate-500 self-center">Keywords: {item.keywords}</span>
                    </div>
                    <p className="mt-2 text-sm font-sinhala line-clamp-2">{item.storySentences}</p>
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