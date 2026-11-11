var KH={
days:30,
h:function(p){var h=5381,s='kh'+p;for(var i=0;i<s.length;i++)h=((h<<5)+h+s.charCodeAt(i))|0;return String(h)},
g:function(k){try{return localStorage.getItem(k)}catch(e){return null}},
s:function(k,v){try{localStorage.setItem(k,v)}catch(e){}},
save:function(r,n){KH.s('kh_last',String(Date.now()));KH.s('kh_role',r||'');KH.s('kh_name',n||'')},
savePin:function(p){KH.s('kh_pin',KH.h(p))},
fresh:function(){var t=parseInt(KH.g('kh_last')||'0',10);return t>0&&Date.now()-t<KH.days*86400000},
can:function(p){var x=KH.g('kh_pin');return !!x&&KH.h(p)===x&&KH.fresh()}
};
