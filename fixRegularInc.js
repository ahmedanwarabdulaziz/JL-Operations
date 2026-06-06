const fs = require('fs');
let c = fs.readFileSync('src/admin/pages/Dashboard/MonthlyTrackerSection.js', 'utf8');

c = c.replace(
  'const [loadingRegular, setLoadingRegular] = useState(false);',
  'const [loadingRegular, setLoadingRegular] = useState(false);\n  const [regularMonthlyIncTemplates, setRegularMonthlyIncTemplates] = useState([]);\n  const [loadingRegularInc, setLoadingRegularInc] = useState(false);'
);

const handleExpStr = `  const handleAddRegularExpense = async (template) => {
    try {
      const data = { ...template, date: new Date().toISOString().split('T')[0], createdAt: new Date() };
      delete data.id;
      await addDoc(collection(db, 'businessExpenses'), data);
      setExtraExpDialog({ open: false, type: 'regular' });
      setRefreshTrigger(v => v + 1);
    } catch(err) {
      console.error(err);
    }
  };`;

const handleIncStr = `\n\n  const handleOpenRegularInc = async () => {
    setExtraIncMenu({ open: false, x: 0, y: 0 });
    setExtraIncDialog({ open: true, type: 'regular' });
    setLoadingRegularInc(true);
    try {
      const snap = await getDocs(query(collection(db, 'regularMonthlyIncomes'), orderBy('createdAt', 'desc')));
      setRegularMonthlyIncTemplates(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch(e) {
      console.error(e);
    } finally {
      setLoadingRegularInc(false);
    }
  };

  const handleAddRegularIncome = async (template) => {
    try {
      const data = { ...template, date: new Date().toISOString().split('T')[0], createdAt: new Date() };
      delete data.id;
      await addDoc(collection(db, 'businessIncome'), data);
      setExtraIncDialog({ open: false, type: 'regular' });
      setRefreshTrigger(v => v + 1);
    } catch(err) {
      console.error(err);
    }
  };`;

c = c.replace(handleExpStr, handleExpStr + handleIncStr);

c = c.replace(
  '<IconButton onClick={(e) => { e.stopPropagation(); () => {}; }}',
  '<IconButton onClick={(e) => { e.stopPropagation(); handleOpenRegularInc(); }}'
);

const dialogRegex = /<Dialog open=\{extraExpDialog\.open && extraExpDialog\.type === 'regular'\}[\s\S]*?<\/Dialog>/;
const dialogMatch = c.match(dialogRegex);

if (dialogMatch) {
  let incDialog = dialogMatch[0]
    .replace(/extraExpDialog/g, 'extraIncDialog')
    .replace(/loadingRegular/g, 'loadingRegularInc')
    .replace(/regularMonthlyTemplates/g, 'regularMonthlyIncTemplates')
    .replace(/handleAddRegularExpense/g, 'handleAddRegularIncome')
    .replace(/Expense/g, 'Income')
    .replace(/Expenses/g, 'Incomes');

  c = c.replace(dialogMatch[0], dialogMatch[0] + '\n\n      ' + incDialog);
}

fs.writeFileSync('src/admin/pages/Dashboard/MonthlyTrackerSection.js', c);
console.log('Done');
