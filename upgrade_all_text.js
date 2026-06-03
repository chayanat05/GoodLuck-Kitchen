const fs = require('fs');

const upgradeTextLevel = (str) => {
    let s = str;
    s = s.replace(/\btext-\[10px\]\b/g, 'text-xs');
    s = s.replace(/\btext-\[15px\]\b/g, 'text-base');
    s = s.replace(/\btext-\[16px\]\b/g, 'text-lg');
    s = s.replace(/\btext-l\b/g, 'text-xl');

    const map = {
        'text-xs': 'text-sm',
        'text-sm': 'text-base',
        'text-base': 'text-lg',
        'text-lg': 'text-xl',
        'text-xl': 'text-2xl',
        'text-2xl': 'text-3xl',
        'text-3xl': 'text-4xl',
        'text-4xl': 'text-5xl',
        'text-5xl': 'text-6xl',
        'text-6xl': 'text-7xl',
        'text-7xl': 'text-8xl',
    };
    
    s = s.replace(/\btext-(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl)\b/g, (match, p1) => {
        return map[match] || match;
    });

    return s;
};

// 1. OrderCard.tsx
const path1 = 'src/components/OrderCard.tsx';
let content1 = fs.readFileSync(path1, 'utf8');

// Pre-bump order number & price
content1 = content1.replace(
  'className={`\${isCompact ? \'text-xs px-2 py-1\' : \'text-sm px-2.5 py-1\'} font-black rounded-lg bg-white/90 text-slate-800 tracking-wider shadow-sm`}',
  'className={`\${isCompact ? \'text-sm px-2 py-1\' : \'text-base px-2.5 py-1\'} font-black rounded-lg bg-white/90 text-slate-800 tracking-wider shadow-sm`}'
);

content1 = content1.replace(
  'className={`font-black text-sm flex items-baseline \${theme.text}`}',
  'className={`font-black text-base flex items-baseline \${theme.text}`}'
);

content1 = content1.replace(
  'className="text-[10px] ml-1 opacity-80"',
  'className="text-xs ml-1 opacity-80"'
);

// Apply global bump
content1 = upgradeTextLevel(content1);
fs.writeFileSync(path1, content1, 'utf8');


// 2. page.tsx
const path2 = 'src/app/board/[board_home]/page.tsx';
let content2 = fs.readFileSync(path2, 'utf8');

// Pre-bump order number & price
content2 = content2.replace(
  'className="text-2xl md:text-3xl font-black text-slate-800 tracking-tighter"',
  'className="text-3xl md:text-4xl font-black text-slate-800 tracking-tighter"'
);

content2 = content2.replace(
  'className="font-black text-blue-600 text-lg"',
  'className="font-black text-blue-600 text-xl"'
);

content2 = content2.replace(
  'className="font-black text-orange-500 text-lg"',
  'className="font-black text-orange-500 text-xl"'
);

// Form inputs
content2 = content2.replace(
  'className="w-full bg-slate-800 border border-slate-700 p-4 rounded-2xl text-lg outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-black text-blue-400 shadow-sm"',
  'className="w-full bg-slate-800 border border-slate-700 p-4 rounded-2xl text-xl outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-black text-blue-400 shadow-sm"'
);

content2 = content2.replace(
  'className="w-full bg-slate-800 border border-slate-700 p-4 rounded-2xl text-lg outline-none focus:ring-4 focus:ring-orange-500/20 focus:border-orange-500 transition-all font-black text-orange-400 shadow-sm"',
  'className="w-full bg-slate-800 border border-slate-700 p-4 rounded-2xl text-xl outline-none focus:ring-4 focus:ring-orange-500/20 focus:border-orange-500 transition-all font-black text-orange-400 shadow-sm"'
);

content2 = content2.replace(
  'className="w-full bg-slate-800 border border-slate-700 p-4 rounded-2xl text-sm outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-bold text-white placeholder-slate-500 shadow-sm"',
  'className="w-full bg-slate-800 border border-slate-700 p-4 rounded-2xl text-base outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-bold text-white placeholder-slate-500 shadow-sm"'
);

// Apply global bump
content2 = upgradeTextLevel(content2);
fs.writeFileSync(path2, content2, 'utf8');

console.log("Updated both files.");
