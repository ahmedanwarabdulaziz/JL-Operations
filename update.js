const fs = require('fs');
let c = fs.readFileSync('src/admin/pages/Dashboard/MonthlyTrackerSection.js', 'utf8');

c = c.replace(
  'const [homeExpenses, setHomeExpenses] = useState([]);',
  'const [homeExpenses, setHomeExpenses] = useState([]);\n  const [homeIncome, setHomeIncome] = useState([]);\n  const [extraIncMenu, setExtraIncMenu] = useState({ open: false, x: 0, y: 0 });\n  const [extraIncDialog, setExtraIncDialog] = useState({ open: false, type: \'home\' });'
);

c = c.replace(
  'const [regularSnap, corpSnap, customerInvSnap, businessExpSnap, generalExpSnap] = await Promise.all([',
  'const [regularSnap, corpSnap, customerInvSnap, businessExpSnap, generalExpSnap, businessIncSnap] = await Promise.all(['
);

c = c.replace(
  'getDocs(query(collection(db, \'generalExpenses\'),   orderBy(\'createdAt\', \'desc\'))),',
  'getDocs(query(collection(db, \'generalExpenses\'),   orderBy(\'createdAt\', \'desc\'))),\n          getDocs(query(collection(db, \'businessIncome\'),  orderBy(\'createdAt\', \'desc\'))),'
);

c = c.replace(
  'setHomeExpenses(allExtraForMonth);',
  'setHomeExpenses(allExtraForMonth);\n\n        const businessIncDocs = businessIncSnap.docs.map(d => ({ id: d.id, ...d.data(), _sourceType: d.data().type || \'business\' }));\n        const allIncomeForMonth = businessIncDocs.filter(e => { const d = toDateObject(e.date || e.createdAt); return d && d.getFullYear() === year && d.getMonth() + 1 === month; });\n        setHomeIncome(allIncomeForMonth);'
);

c = c.replace(
  'const totalHomeExpenses = homeExpenses.reduce((s, e) => s + (parseFloat(e.total) || 0), 0);',
  'const totalHomeExpenses = homeExpenses.reduce((s, e) => s + (parseFloat(e.total) || 0), 0);\n  const totalHomeIncome = homeIncome.reduce((s, e) => s + (parseFloat(e.total) || 0), 0);'
);

c = c.replace(
  'const clearTotal        = totalClear - totalHomeExpenses;',
  'const clearTotal        = totalClear - totalHomeExpenses + totalHomeIncome;'
);

c = c.replace(
  '? Extra Expenses: {fmt(totalHomeExpenses)}',
  '? Extra Expenses: {fmt(totalHomeExpenses)}\n                  </Typography>\n                  <Typography variant=" body2\ sx={{ color: \'#4caf50\', fontWeight: \'bold\' }}>\n + Extra Income: {fmt(totalHomeIncome)}'
);

let btnStr = <Button
 variant=\outlined\
 size=\small\
 startIcon={<AddIcon />}
 onClick={(e) => setExtraExpMenu({ open: true, x: e.clientX, y: e.clientY })}
 sx={{
 color: '#b98f33',
 borderColor: '#b98f33',
 '&:hover': { borderColor: '#d4af37', backgroundColor: 'rgba(185, 143, 51, 0.1)' }
 }}
 >
 Add Extra Expense
 </Button>;

let newBtnStr = btnStr + \n <Button
 variant=\outlined\
 size=\small\
 startIcon={<TrendingUpIcon />}
 onClick={(e) => setExtraIncMenu({ open: true, x: e.clientX, y: e.clientY })}
 sx={{
 color: '#4caf50',
 borderColor: '#4caf50',
 '&:hover': { borderColor: '#81c784', backgroundColor: 'rgba(76, 175, 80, 0.1)' }
 }}
 >
 Add Extra Income
 </Button>;

c = c.replace(btnStr, newBtnStr);

fs.writeFileSync('src/admin/pages/Dashboard/MonthlyTrackerSection.js', c);
