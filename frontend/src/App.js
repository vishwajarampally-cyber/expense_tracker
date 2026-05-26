import React,{useEffect,useMemo,useState} from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || '/api/expenses';
const CATEGORIES = ['Food','Transport','Shopping','Bills','Health','Entertainment','Travel','Education','Other'];

function buildTips(expenses,total){
 const byCategory = expenses.reduce((groups,expense)=>{
   const category = expense.category || 'Other';
   groups[category] = (groups[category] || 0) + Number(expense.amount || 0);
   return groups;
 },{});
 const topCategory = Object.entries(byCategory).sort((a,b)=>b[1]-a[1])[0];
 const tips = [];

 if(!expenses.length) return ['Upload a few bills to see personalized saving tips.'];
 if(topCategory?.[0] === 'Food') tips.push('Food is your highest spend. Try setting a weekly eating-out limit and grouping grocery purchases.');
 if(topCategory?.[0] === 'Shopping') tips.push('Shopping is leading this list. Add a 24-hour pause before non-essential purchases.');
 if(topCategory?.[0] === 'Transport') tips.push('Transport is adding up. Compare shared rides, public transport, or weekly pass options.');
 if(topCategory?.[0] === 'Entertainment') tips.push('Entertainment is high. Review subscriptions and cancel anything unused this month.');
 if(topCategory?.[0] === 'Bills') tips.push('Bills are the largest category. Check plans, autopay discounts, and duplicate services.');
 if(total > 5000) tips.push('Your tracked total is above Rs 5000. Split expenses into needs, wants, and savings before the next purchase.');
 tips.push('Keep uploading bills as soon as you pay so small expenses do not disappear from memory.');
 return tips.slice(0,3);
}

export default function App(){
 const [expenses,setExpenses]=useState([]);
 const [bill,setBill]=useState(null);
 const [preview,setPreview]=useState('');
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState('');
 const [latest,setLatest]=useState(null);
 const [editing,setEditing]=useState(null);

 const total = useMemo(
   ()=>expenses.reduce((sum,expense)=>sum + Number(expense.amount || 0),0),
   [expenses]
 );
 const tips = useMemo(()=>buildTips(expenses,total),[expenses,total]);

 const fetchData=async()=>{
   try {
     setExpenses((await axios.get(API_URL)).data);
     setError('');
   } catch (err) {
     setError('Backend is not reachable. Please start the API server.');
   }
 };

 useEffect(()=>{fetchData()},[]);

 const chooseBill=(event)=>{
   const file = event.target.files?.[0];
   setBill(file || null);
   setLatest(null);
   setError('');
   setPreview(file ? URL.createObjectURL(file) : '');
 };

 const uploadBill=async()=>{
   if(!bill){
     setError('Choose a JPG or PNG bill image first.');
     return;
   }

   const formData = new FormData();
   formData.append('bill',bill);

   try {
     setLoading(true);
     const response = await axios.post(`${API_URL}/analyze-bill`,formData);
     setLatest(response.data.expense);
     setBill(null);
     setPreview('');
     await fetchData();
   } catch (err) {
     setError(err.response?.data?.error || 'Unable to analyze this bill.');
   } finally {
     setLoading(false);
   }
 };

 const startEdit=(expense)=>{
   setEditing({
     ...expense,
     amount:String(expense.amount ?? '')
   });
   setError('');
 };

 const saveEdit=async()=>{
   try {
     const payload = {
       title: editing.title,
       amount:Number(editing.amount),
       category: editing.category,
       notes: editing.notes || ''
     };
     await axios.put(`${API_URL}/${editing._id}`,payload);
     setEditing(null);
     await fetchData();
   } catch (err) {
     setError(err.response?.data?.error || 'Unable to update expense.');
   }
 };

 const deleteExpense=async(id)=>{
   try {
     await axios.delete(`${API_URL}/${id}`);
     if(editing?._id === id) setEditing(null);
     await fetchData();
   } catch (err) {
     setError(err.response?.data?.error || 'Unable to delete expense.');
   }
 };

 return <main style={styles.page}>
   <section style={styles.header}>
     <div>
       <h1 style={styles.title}>AI Expense Tracker</h1>
       <p style={styles.subtle}>Upload a bill image to extract the payable amount and expense category.</p>
     </div>
     <div style={styles.total}>
       <span style={styles.totalLabel}>Tracked total</span>
       <strong style={styles.totalValue}>Rs {total.toFixed(2)}</strong>
     </div>
   </section>

   <section style={styles.panel}>
     <div style={styles.uploadRow}>
       <label style={styles.fileBox}>
         <input accept='image/png,image/jpeg' type='file' onChange={chooseBill} style={styles.fileInput} />
         {preview ? <img src={preview} alt='Selected bill preview' style={styles.preview} /> : <span style={styles.filePrompt}>Choose bill image</span>}
       </label>
       <div style={styles.actions}>
         <h2 style={styles.sectionTitle}>Analyze Bill</h2>
         <p style={styles.subtle}>The model reads the receipt image and returns the merchant, final amount, and category.</p>
         <button disabled={loading} onClick={uploadBill} style={{...styles.button,opacity:loading ? 0.7 : 1}}>
           {loading ? 'Analyzing...' : 'Upload and Analyze'}
         </button>
         {error && <p style={styles.error}>{error}</p>}
         {latest && <p style={styles.success}>Added: {latest.title} - Rs {Number(latest.amount || 0).toFixed(2)} - {latest.category}</p>}
       </div>
     </div>
   </section>

   <section style={styles.tips}>
     <h2 style={styles.sectionTitle}>Expense Tips</h2>
     {tips.map(tip=><p key={tip} style={styles.tip}>{tip}</p>)}
   </section>

   <section style={styles.list}>
     <h2 style={styles.sectionTitle}>Expenses</h2>
     {expenses.length === 0 && <p style={styles.subtle}>No expenses yet. Upload a bill to begin.</p>}
     {expenses.map(expense=><article key={expense._id} style={styles.item}>
       {expense.image && <img src={expense.image} alt={`${expense.title} bill`} style={styles.thumb} />}
       {editing?._id === expense._id ? <div style={styles.editForm}>
         <input value={editing.title} onChange={e=>setEditing({...editing,title:e.target.value})} style={styles.input} />
         <input type='number' value={editing.amount} onChange={e=>setEditing({...editing,amount:e.target.value})} style={styles.input} />
         <select value={editing.category} onChange={e=>setEditing({...editing,category:e.target.value})} style={styles.input}>
           {CATEGORIES.map(category=><option key={category} value={category}>{category}</option>)}
         </select>
         <input value={editing.notes || ''} placeholder='Notes' onChange={e=>setEditing({...editing,notes:e.target.value})} style={styles.input} />
         <div style={styles.buttonRow}>
           <button onClick={saveEdit} style={styles.smallButton}>Save</button>
           <button onClick={()=>setEditing(null)} style={styles.secondaryButton}>Cancel</button>
         </div>
       </div> : <>
         <div style={styles.itemBody}>
           <strong>{expense.title}</strong>
           <span style={styles.subtle}>{expense.category}</span>
           {expense.notes && <span style={styles.notes}>{expense.notes}</span>}
         </div>
         <strong style={styles.amount}>Rs {Number(expense.amount || 0).toFixed(2)}</strong>
         <div style={styles.buttonRow}>
           <button onClick={()=>startEdit(expense)} style={styles.secondaryButton}>Edit</button>
           <button onClick={()=>deleteExpense(expense._id)} style={styles.dangerButton}>Delete</button>
         </div>
       </>}
     </article>)}
   </section>
 </main>
}

const styles = {
 page:{minHeight:'100vh',padding:24,fontFamily:'Arial, sans-serif',background:'#f6f7f9',color:'#1f2933'},
 header:{display:'flex',justifyContent:'space-between',gap:20,alignItems:'center',maxWidth:980,margin:'0 auto 20px'},
 title:{margin:0,fontSize:32},
 subtle:{margin:'6px 0 0',color:'#667085',lineHeight:1.4},
 total:{background:'#fff',border:'1px solid #d8dee8',borderRadius:8,padding:'12px 16px',minWidth:170},
 totalLabel:{display:'block',fontSize:13,color:'#667085'},
 totalValue:{display:'block',fontSize:22,marginTop:4},
 panel:{maxWidth:980,margin:'0 auto 20px',background:'#fff',border:'1px solid #d8dee8',borderRadius:8,padding:18},
 uploadRow:{display:'grid',gridTemplateColumns:'minmax(220px,320px) 1fr',gap:20,alignItems:'stretch'},
 fileBox:{border:'1px dashed #98a2b3',borderRadius:8,minHeight:220,display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden',cursor:'pointer',background:'#fbfcfe'},
 fileInput:{display:'none'},
 filePrompt:{fontWeight:700,color:'#344054'},
 preview:{width:'100%',height:'100%',objectFit:'cover'},
 actions:{display:'flex',flexDirection:'column',alignItems:'flex-start',justifyContent:'center'},
 sectionTitle:{margin:'0 0 8px',fontSize:20},
 button:{marginTop:16,border:0,borderRadius:6,background:'#2563eb',color:'#fff',fontWeight:700,padding:'11px 16px',cursor:'pointer'},
 smallButton:{border:0,borderRadius:6,background:'#2563eb',color:'#fff',fontWeight:700,padding:'8px 12px',cursor:'pointer'},
 secondaryButton:{border:'1px solid #c7cfdb',borderRadius:6,background:'#fff',color:'#344054',fontWeight:700,padding:'8px 12px',cursor:'pointer'},
 dangerButton:{border:'1px solid #f3b5b5',borderRadius:6,background:'#fff5f5',color:'#b42318',fontWeight:700,padding:'8px 12px',cursor:'pointer'},
 error:{color:'#b42318',margin:'12px 0 0'},
 success:{color:'#047857',margin:'12px 0 0'},
 tips:{maxWidth:980,margin:'0 auto 20px',background:'#fff',border:'1px solid #d8dee8',borderRadius:8,padding:18},
 tip:{margin:'8px 0',color:'#344054'},
 list:{maxWidth:980,margin:'0 auto',background:'#fff',border:'1px solid #d8dee8',borderRadius:8,padding:18},
 item:{display:'flex',alignItems:'center',gap:14,padding:'12px 0',borderTop:'1px solid #edf0f5'},
 thumb:{width:58,height:58,objectFit:'cover',borderRadius:6,border:'1px solid #d8dee8'},
 itemBody:{display:'flex',flexDirection:'column',gap:3,flex:1},
 notes:{fontSize:13,color:'#667085'},
 amount:{fontSize:18,minWidth:110,textAlign:'right'},
 buttonRow:{display:'flex',gap:8,alignItems:'center'},
 editForm:{display:'grid',gridTemplateColumns:'1.2fr 0.7fr 0.8fr 1fr auto',gap:8,alignItems:'center',flex:1},
 input:{border:'1px solid #c7cfdb',borderRadius:6,padding:'9px 10px',fontSize:14,minWidth:0}
};
