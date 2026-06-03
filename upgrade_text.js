const fs = require('fs');
const upgradeTextLevel = (str) => {
    let s = str;
    s = s.replace(/\btext-6xl\b/g, 'text-7xl');
    s = s.replace(/\btext-5xl\b/g, 'text-6xl');
    s = s.replace(/\btext-4xl\b/g, 'text-5xl');
    s = s.replace(/\btext-3xl\b/g, 'text-4xl');
    s = s.replace(/\btext-2xl\b/g, 'text-3xl');
    s = s.replace(/\btext-xl\b/g, 'text-2xl');
    s = s.replace(/\btext-lg\b/g, 'text-xl');
    s = s.replace(/\btext-base\b/g, 'text-lg');
    s = s.replace(/\btext-sm\b/g, 'text-base');
    s = s.replace(/\btext-xs\b/g, 'text-sm');
    s = s.replace(/\btext-\[10px\]\b/g, 'text-xs');
    s = s.replace(/\btext-\[15px\]\b/g, 'text-base');
    s = s.replace(/\btext-\[16px\]\b/g, 'text-lg');
    s = s.replace(/\btext-l\b/g, 'text-xl');
    return s;
};

const path1 = 'c:/Users/chaya/Store/GoodLuck-Kitchen/src/components/OrderCard.tsx';
let content1 = fs.readFileSync(path1, 'utf8');
content1 = content1.replace(
  /\/g,
  ""
);
content1 = content1.replace(
  /font-black text-sm flex items-baseline/g,
  'font-black text-xl flex items-baseline'
);
content1 = content1.replace(
  /className=\"text-\[10px\] ml-1 opacity-80\"/g,
  'className=\"text-sm ml-1 opacity-80\"'
);
content1 = upgradeTextLevel(content1);
fs.writeFileSync(path1, content1, 'utf8');

const path2 = 'c:/Users/chaya/Store/GoodLuck-Kitchen/src/app/board/[board_home]/page.tsx';
let content2 = fs.readFileSync(path2, 'utf8');
content2 = content2.replace(
  /className=\"text-2xl md:text-3xl font-black text-slate-800 tracking-tighter\"/g,
  'className=\"text-4xl md:text-5xl font-black text-slate-800 tracking-tighter\"'
);
content2 = content2.replace(
  /className=\"font-black text-blue-600 text-lg\"/g,
  'className=\"font-black text-blue-600 text-2xl\"'
);
content2 = content2.replace(
  /className=\"font-black text-orange-500 text-lg\"/g,
  'className=\"font-black text-orange-500 text-2xl\"'
);
content2 = content2.replace(
  /className=\"w-full bg-slate-800 border border-slate-700 p-4 rounded-2xl text-lg outline-none focus:ring-4 focus:ring-blue-500\\/20 focus:border-blue-500 transition-all font-black text-blue-400 shadow-sm\"/g,
  'className=\"w-full bg-slate-800 border border-slate-700 p-4 rounded-2xl text-2xl outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-black text-blue-400 shadow-sm\"'
);
content2 = content2.replace(
  /className=\"w-full bg-slate-800 border border-slate-700 p-4 rounded-2xl text-lg outline-none focus:ring-4 focus:ring-orange-500\\/20 focus:border-orange-500 transition-all font-black text-orange-400 shadow-sm\"/g,
  'className=\"w-full bg-slate-800 border border-slate-700 p-4 rounded-2xl text-2xl outline-none focus:ring-4 focus:ring-orange-500/20 focus:border-orange-500 transition-all font-black text-orange-400 shadow-sm\"'
);
content2 = content2.replace(
  /className=\"w-full bg-slate-800 border border-slate-700 p-4 rounded-2xl text-sm outline-none focus:ring-4 focus:ring-blue-500\\/20 focus:border-blue-500 transition-all font-bold text-white placeholder-slate-500 shadow-sm\"/g,
  'className=\"w-full bg-slate-800 border border-slate-700 p-4 rounded-2xl text-lg outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-bold text-white placeholder-slate-500 shadow-sm\"'
);
content2 = upgradeTextLevel(content2);
fs.writeFileSync(path2, content2, 'utf8');
console.log('Update complete.');
