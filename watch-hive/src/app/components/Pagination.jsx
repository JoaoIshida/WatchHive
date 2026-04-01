 "use client";
 
 import React, { memo, useMemo } from "react";
 
 const clamp = (n, min, max) => Math.min(Math.max(n, min), max);
 
 const getPageItems = (page, totalPages) => {
   const safeTotal = Math.max(1, totalPages || 1);
   const safePage = clamp(page || 1, 1, safeTotal);
 
   if (safeTotal <= 4) {
     return Array.from({ length: safeTotal }, (_, i) => i + 1);
   }
 
   const first = 1;
   const last = safeTotal;
 
   // Show up to 4 numeric pages in view, plus ellipses and first/last.
   if (safePage <= 2) return [1, 2, 3, 4, "...", last];
   if (safePage >= safeTotal - 1) return [first, "...", safeTotal - 3, safeTotal - 2, safeTotal - 1, safeTotal];
 
   return [first, "...", safePage - 1, safePage, safePage + 1, "...", last];
 };
 
 const Pagination = memo(function Pagination({ page, totalPages, onPageChange, className = "" }) {
   const safeTotal = Math.max(1, totalPages || 1);
   const safePage = clamp(page || 1, 1, safeTotal);
 
   const items = useMemo(() => getPageItems(safePage, safeTotal), [safePage, safeTotal]);
 
   return (
     <div className={`flex flex-col items-center justify-center my-6 gap-2 ${className}`}>
       <div className="text-xs text-white/70">
         Page <span className="text-amber-400 font-semibold">{safePage}</span> of{" "}
         <span className="text-amber-400 font-semibold">{safeTotal}</span>
       </div>
 
       <div className="flex items-center justify-center gap-2 flex-wrap">
         <button
           onClick={() => onPageChange(Math.max(safePage - 1, 1))}
           className="futuristic-button disabled:opacity-50 disabled:cursor-not-allowed"
           disabled={safePage === 1}
         >
           Prev
         </button>
 
         {items.map((it, idx) => {
           if (it === "...") {
             return (
               <span key={`ellipsis-${idx}`} className="px-2 text-white/60 select-none">
                 ...
               </span>
             );
           }
 
           const p = it;
           const isActive = p === safePage;
           return (
             <button
               key={p}
               onClick={() => onPageChange(p)}
               className={
                 isActive
                   ? "bg-charcoal-800/80 border border-amber-500/60 text-amber-400 font-bold px-3 py-2 rounded-lg"
                   : "bg-charcoal-900/40 border border-charcoal-700/40 text-white/80 hover:text-amber-200 hover:border-amber-500/30 px-3 py-2 rounded-lg transition-colors"
               }
             >
               {p}
             </button>
           );
         })}
 
         <button
           onClick={() => onPageChange(Math.min(safePage + 1, safeTotal))}
           className="futuristic-button disabled:opacity-50 disabled:cursor-not-allowed"
           disabled={safePage >= safeTotal}
         >
           Next
         </button>
       </div>
     </div>
   );
 });
 
 export default Pagination;
