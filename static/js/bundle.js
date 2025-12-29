"use strict";(()=>{var K,h,ze,fn,$,je,Ve,qe,Ge,me,_e,de,Ze,Y={},Ye=[],pn=/acit|ex(?:s|g|n|p|$)|rph|grid|ows|mnc|ntw|ine[ch]|zoo|^ord|itera/i,Q=Array.isArray;function L(e,t){for(var n in t)e[n]=t[n];return e}function he(e){e&&e.parentNode&&e.parentNode.removeChild(e)}function C(e,t,n){var o,r,a,i={};for(a in t)a=="key"?o=t[a]:a=="ref"?r=t[a]:i[a]=t[a];if(arguments.length>2&&(i.children=arguments.length>3?K.call(arguments,2):n),typeof e=="function"&&e.defaultProps!=null)for(a in e.defaultProps)i[a]===void 0&&(i[a]=e.defaultProps[a]);return Z(e,i,o,r,null)}function Z(e,t,n,o,r){var a={type:e,props:t,key:n,ref:o,__k:null,__:null,__b:0,__e:null,__c:null,constructor:void 0,__v:r??++ze,__i:-1,__u:0};return r==null&&h.vnode!=null&&h.vnode(a),a}function be(){return{current:null}}function k(e){return e.children}function T(e,t){this.props=e,this.context=t}function W(e,t){if(t==null)return e.__?W(e.__,e.__i+1):null;for(var n;t<e.__k.length;t++)if((n=e.__k[t])!=null&&n.__e!=null)return n.__e;return typeof e.type=="function"?W(e):null}function Ke(e){var t,n;if((e=e.__)!=null&&e.__c!=null){for(e.__e=e.__c.base=null,t=0;t<e.__k.length;t++)if((n=e.__k[t])!=null&&n.__e!=null){e.__e=e.__c.base=n.__e;break}return Ke(e)}}function fe(e){(!e.__d&&(e.__d=!0)&&$.push(e)&&!ae.__r++||je!=h.debounceRendering)&&((je=h.debounceRendering)||Ve)(ae)}function ae(){for(var e,t,n,o,r,a,i,l=1;$.length;)$.length>l&&$.sort(qe),e=$.shift(),l=$.length,e.__d&&(n=void 0,o=void 0,r=(o=(t=e).__v).__e,a=[],i=[],t.__P&&((n=L({},o)).__v=o.__v+1,h.vnode&&h.vnode(n),ge(t.__P,n,o,t.__n,t.__P.namespaceURI,32&o.__u?[r]:null,a,r??W(o),!!(32&o.__u),i),n.__v=o.__v,n.__.__k[n.__i]=n,et(a,n,i),o.__e=o.__=null,n.__e!=r&&Ke(n)));ae.__r=0}function Qe(e,t,n,o,r,a,i,l,_,u,d){var c,p,m,w,E,x,g,b=o&&o.__k||Ye,A=t.length;for(_=mn(n,t,b,_,A),c=0;c<A;c++)(m=n.__k[c])!=null&&(p=m.__i==-1?Y:b[m.__i]||Y,m.__i=c,x=ge(e,m,p,r,a,i,l,_,u,d),w=m.__e,m.ref&&p.ref!=m.ref&&(p.ref&&ve(p.ref,null,m),d.push(m.ref,m.__c||w,m)),E==null&&w!=null&&(E=w),(g=!!(4&m.__u))||p.__k===m.__k?_=Xe(m,_,e,g):typeof m.type=="function"&&x!==void 0?_=x:w&&(_=w.nextSibling),m.__u&=-7);return n.__e=E,_}function mn(e,t,n,o,r){var a,i,l,_,u,d=n.length,c=d,p=0;for(e.__k=new Array(r),a=0;a<r;a++)(i=t[a])!=null&&typeof i!="boolean"&&typeof i!="function"?(typeof i=="string"||typeof i=="number"||typeof i=="bigint"||i.constructor==String?i=e.__k[a]=Z(null,i,null,null,null):Q(i)?i=e.__k[a]=Z(k,{children:i},null,null,null):i.constructor==null&&i.__b>0?i=e.__k[a]=Z(i.type,i.props,i.key,i.ref?i.ref:null,i.__v):e.__k[a]=i,_=a+p,i.__=e,i.__b=e.__b+1,l=null,(u=i.__i=hn(i,n,_,c))!=-1&&(c--,(l=n[u])&&(l.__u|=2)),l==null||l.__v==null?(u==-1&&(r>d?p--:r<d&&p++),typeof i.type!="function"&&(i.__u|=4)):u!=_&&(u==_-1?p--:u==_+1?p++:(u>_?p--:p++,i.__u|=4))):e.__k[a]=null;if(c)for(a=0;a<d;a++)(l=n[a])!=null&&(2&l.__u)==0&&(l.__e==o&&(o=W(l)),nt(l,l));return o}function Xe(e,t,n,o){var r,a;if(typeof e.type=="function"){for(r=e.__k,a=0;r&&a<r.length;a++)r[a]&&(r[a].__=e,t=Xe(r[a],t,n,o));return t}e.__e!=t&&(o&&(t&&e.type&&!t.parentNode&&(t=W(e)),n.insertBefore(e.__e,t||null)),t=e.__e);do t=t&&t.nextSibling;while(t!=null&&t.nodeType==8);return t}function I(e,t){return t=t||[],e==null||typeof e=="boolean"||(Q(e)?e.some(function(n){I(n,t)}):t.push(e)),t}function hn(e,t,n,o){var r,a,i,l=e.key,_=e.type,u=t[n],d=u!=null&&(2&u.__u)==0;if(u===null&&l==null||d&&l==u.key&&_==u.type)return n;if(o>(d?1:0)){for(r=n-1,a=n+1;r>=0||a<t.length;)if((u=t[i=r>=0?r--:a++])!=null&&(2&u.__u)==0&&l==u.key&&_==u.type)return i}return-1}function We(e,t,n){t[0]=="-"?e.setProperty(t,n??""):e[t]=n==null?"":typeof n!="number"||pn.test(t)?n:n+"px"}function re(e,t,n,o,r){var a,i;e:if(t=="style")if(typeof n=="string")e.style.cssText=n;else{if(typeof o=="string"&&(e.style.cssText=o=""),o)for(t in o)n&&t in n||We(e.style,t,"");if(n)for(t in n)o&&n[t]==o[t]||We(e.style,t,n[t])}else if(t[0]=="o"&&t[1]=="n")a=t!=(t=t.replace(Ge,"$1")),i=t.toLowerCase(),t=i in e||t=="onFocusOut"||t=="onFocusIn"?i.slice(2):t.slice(2),e.l||(e.l={}),e.l[t+a]=n,n?o?n.u=o.u:(n.u=me,e.addEventListener(t,a?de:_e,a)):e.removeEventListener(t,a?de:_e,a);else{if(r=="http://www.w3.org/2000/svg")t=t.replace(/xlink(H|:h)/,"h").replace(/sName$/,"s");else if(t!="width"&&t!="height"&&t!="href"&&t!="list"&&t!="form"&&t!="tabIndex"&&t!="download"&&t!="rowSpan"&&t!="colSpan"&&t!="role"&&t!="popover"&&t in e)try{e[t]=n??"";break e}catch{}typeof n=="function"||(n==null||n===!1&&t[4]!="-"?e.removeAttribute(t):e.setAttribute(t,t=="popover"&&n==1?"":n))}}function Be(e){return function(t){if(this.l){var n=this.l[t.type+e];if(t.t==null)t.t=me++;else if(t.t<n.u)return;return n(h.event?h.event(t):t)}}}function ge(e,t,n,o,r,a,i,l,_,u){var d,c,p,m,w,E,x,g,b,A,O,ne,q,Ue,oe,G,ue,H=t.type;if(t.constructor!=null)return null;128&n.__u&&(_=!!(32&n.__u),a=[l=t.__e=n.__e]),(d=h.__b)&&d(t);e:if(typeof H=="function")try{if(g=t.props,b="prototype"in H&&H.prototype.render,A=(d=H.contextType)&&o[d.__c],O=d?A?A.props.value:d.__:o,n.__c?x=(c=t.__c=n.__c).__=c.__E:(b?t.__c=c=new H(g,O):(t.__c=c=new T(g,O),c.constructor=H,c.render=gn),A&&A.sub(c),c.state||(c.state={}),c.__n=o,p=c.__d=!0,c.__h=[],c._sb=[]),b&&c.__s==null&&(c.__s=c.state),b&&H.getDerivedStateFromProps!=null&&(c.__s==c.state&&(c.__s=L({},c.__s)),L(c.__s,H.getDerivedStateFromProps(g,c.__s))),m=c.props,w=c.state,c.__v=t,p)b&&H.getDerivedStateFromProps==null&&c.componentWillMount!=null&&c.componentWillMount(),b&&c.componentDidMount!=null&&c.__h.push(c.componentDidMount);else{if(b&&H.getDerivedStateFromProps==null&&g!==m&&c.componentWillReceiveProps!=null&&c.componentWillReceiveProps(g,O),t.__v==n.__v||!c.__e&&c.shouldComponentUpdate!=null&&c.shouldComponentUpdate(g,c.__s,O)===!1){for(t.__v!=n.__v&&(c.props=g,c.state=c.__s,c.__d=!1),t.__e=n.__e,t.__k=n.__k,t.__k.some(function(j){j&&(j.__=t)}),ne=0;ne<c._sb.length;ne++)c.__h.push(c._sb[ne]);c._sb=[],c.__h.length&&i.push(c);break e}c.componentWillUpdate!=null&&c.componentWillUpdate(g,c.__s,O),b&&c.componentDidUpdate!=null&&c.__h.push(function(){c.componentDidUpdate(m,w,E)})}if(c.context=O,c.props=g,c.__P=e,c.__e=!1,q=h.__r,Ue=0,b){for(c.state=c.__s,c.__d=!1,q&&q(t),d=c.render(c.props,c.state,c.context),oe=0;oe<c._sb.length;oe++)c.__h.push(c._sb[oe]);c._sb=[]}else do c.__d=!1,q&&q(t),d=c.render(c.props,c.state,c.context),c.state=c.__s;while(c.__d&&++Ue<25);c.state=c.__s,c.getChildContext!=null&&(o=L(L({},o),c.getChildContext())),b&&!p&&c.getSnapshotBeforeUpdate!=null&&(E=c.getSnapshotBeforeUpdate(m,w)),G=d,d!=null&&d.type===k&&d.key==null&&(G=tt(d.props.children)),l=Qe(e,Q(G)?G:[G],t,n,o,r,a,i,l,_,u),c.base=t.__e,t.__u&=-161,c.__h.length&&i.push(c),x&&(c.__E=c.__=null)}catch(j){if(t.__v=null,_||a!=null)if(j.then){for(t.__u|=_?160:128;l&&l.nodeType==8&&l.nextSibling;)l=l.nextSibling;a[a.indexOf(l)]=null,t.__e=l}else{for(ue=a.length;ue--;)he(a[ue]);pe(t)}else t.__e=n.__e,t.__k=n.__k,j.then||pe(t);h.__e(j,t,n)}else a==null&&t.__v==n.__v?(t.__k=n.__k,t.__e=n.__e):l=t.__e=bn(n.__e,t,n,o,r,a,i,_,u);return(d=h.diffed)&&d(t),128&t.__u?void 0:l}function pe(e){e&&e.__c&&(e.__c.__e=!0),e&&e.__k&&e.__k.forEach(pe)}function et(e,t,n){for(var o=0;o<n.length;o++)ve(n[o],n[++o],n[++o]);h.__c&&h.__c(t,e),e.some(function(r){try{e=r.__h,r.__h=[],e.some(function(a){a.call(r)})}catch(a){h.__e(a,r.__v)}})}function tt(e){return typeof e!="object"||e==null||e.__b&&e.__b>0?e:Q(e)?e.map(tt):L({},e)}function bn(e,t,n,o,r,a,i,l,_){var u,d,c,p,m,w,E,x=n.props||Y,g=t.props,b=t.type;if(b=="svg"?r="http://www.w3.org/2000/svg":b=="math"?r="http://www.w3.org/1998/Math/MathML":r||(r="http://www.w3.org/1999/xhtml"),a!=null){for(u=0;u<a.length;u++)if((m=a[u])&&"setAttribute"in m==!!b&&(b?m.localName==b:m.nodeType==3)){e=m,a[u]=null;break}}if(e==null){if(b==null)return document.createTextNode(g);e=document.createElementNS(r,b,g.is&&g),l&&(h.__m&&h.__m(t,a),l=!1),a=null}if(b==null)x===g||l&&e.data==g||(e.data=g);else{if(a=a&&K.call(e.childNodes),!l&&a!=null)for(x={},u=0;u<e.attributes.length;u++)x[(m=e.attributes[u]).name]=m.value;for(u in x)if(m=x[u],u!="children"){if(u=="dangerouslySetInnerHTML")c=m;else if(!(u in g)){if(u=="value"&&"defaultValue"in g||u=="checked"&&"defaultChecked"in g)continue;re(e,u,null,m,r)}}for(u in g)m=g[u],u=="children"?p=m:u=="dangerouslySetInnerHTML"?d=m:u=="value"?w=m:u=="checked"?E=m:l&&typeof m!="function"||x[u]===m||re(e,u,m,x[u],r);if(d)l||c&&(d.__html==c.__html||d.__html==e.innerHTML)||(e.innerHTML=d.__html),t.__k=[];else if(c&&(e.innerHTML=""),Qe(t.type=="template"?e.content:e,Q(p)?p:[p],t,n,o,b=="foreignObject"?"http://www.w3.org/1999/xhtml":r,a,i,a?a[0]:n.__k&&W(n,0),l,_),a!=null)for(u=a.length;u--;)he(a[u]);l||(u="value",b=="progress"&&w==null?e.removeAttribute("value"):w!=null&&(w!==e[u]||b=="progress"&&!w||b=="option"&&w!=x[u])&&re(e,u,w,x[u],r),u="checked",E!=null&&E!=e[u]&&re(e,u,E,x[u],r))}return e}function ve(e,t,n){try{if(typeof e=="function"){var o=typeof e.__u=="function";o&&e.__u(),o&&t==null||(e.__u=e(t))}else e.current=t}catch(r){h.__e(r,n)}}function nt(e,t,n){var o,r;if(h.unmount&&h.unmount(e),(o=e.ref)&&(o.current&&o.current!=e.__e||ve(o,null,t)),(o=e.__c)!=null){if(o.componentWillUnmount)try{o.componentWillUnmount()}catch(a){h.__e(a,t)}o.base=o.__P=null}if(o=e.__k)for(r=0;r<o.length;r++)o[r]&&nt(o[r],t,n||typeof e.type!="function");n||he(e.__e),e.__c=e.__=e.__e=void 0}function gn(e,t,n){return this.constructor(e,n)}function F(e,t,n){var o,r,a,i;t==document&&(t=document.documentElement),h.__&&h.__(e,t),r=(o=typeof n=="function")?null:n&&n.__k||t.__k,a=[],i=[],ge(t,e=(!o&&n||t).__k=C(k,null,[e]),r||Y,Y,t.namespaceURI,!o&&n?[n]:r?null:t.firstChild?K.call(t.childNodes):null,a,!o&&n?n:r?r.__e:t.firstChild,o,i),et(a,e,i)}function ye(e,t){F(e,t,ye)}function ot(e,t,n){var o,r,a,i,l=L({},e.props);for(a in e.type&&e.type.defaultProps&&(i=e.type.defaultProps),t)a=="key"?o=t[a]:a=="ref"?r=t[a]:l[a]=t[a]===void 0&&i!=null?i[a]:t[a];return arguments.length>2&&(l.children=arguments.length>3?K.call(arguments,2):n),Z(e.type,l,o||e.key,r||e.ref,null)}function we(e){function t(n){var o,r;return this.getChildContext||(o=new Set,(r={})[t.__c]=this,this.getChildContext=function(){return r},this.componentWillUnmount=function(){o=null},this.shouldComponentUpdate=function(a){this.props.value!=a.value&&o.forEach(function(i){i.__e=!0,fe(i)})},this.sub=function(a){o.add(a);var i=a.componentWillUnmount;a.componentWillUnmount=function(){o&&o.delete(a),i&&i.call(a)}}),n.children}return t.__c="__cC"+Ze++,t.__=e,t.Provider=t.__l=(t.Consumer=function(n,o){return n.children(o)}).contextType=t,t}K=Ye.slice,h={__e:function(e,t,n,o){for(var r,a,i;t=t.__;)if((r=t.__c)&&!r.__)try{if((a=r.constructor)&&a.getDerivedStateFromError!=null&&(r.setState(a.getDerivedStateFromError(e)),i=r.__d),r.componentDidCatch!=null&&(r.componentDidCatch(e,o||{}),i=r.__d),i)return r.__E=r}catch(l){e=l}throw e}},ze=0,fn=function(e){return e!=null&&e.constructor==null},T.prototype.setState=function(e,t){var n;n=this.__s!=null&&this.__s!=this.state?this.__s:this.__s=L({},this.state),typeof e=="function"&&(e=e(L({},n),this.props)),e&&L(n,e),e!=null&&this.__v&&(t&&this._sb.push(t),fe(this))},T.prototype.forceUpdate=function(e){this.__v&&(this.__e=!0,e&&this.__h.push(e),fe(this))},T.prototype.render=k,$=[],Ve=typeof Promise=="function"?Promise.prototype.then.bind(Promise.resolve()):setTimeout,qe=function(e,t){return e.__v.__b-t.__v.__b},ae.__r=0,Ge=/(PointerCapture)$|Capture$/i,me=0,_e=Be(!1),de=Be(!0),Ze=0;var R,v,xe,rt,B=0,dt=[],y=h,at=y.__b,it=y.__r,lt=y.diffed,st=y.__c,ct=y.unmount,ut=y.__;function z(e,t){y.__h&&y.__h(v,e,B||t),B=0;var n=v.__H||(v.__H={__:[],__h:[]});return e>=n.__.length&&n.__.push({}),n.__[e]}function D(e){return B=1,le(ft,e)}function le(e,t,n){var o=z(R++,2);if(o.t=e,!o.__c&&(o.__=[n?n(t):ft(void 0,t),function(l){var _=o.__N?o.__N[0]:o.__[0],u=o.t(_,l);_!==u&&(o.__N=[u,o.__[1]],o.__c.setState({}))}],o.__c=v,!v.__f)){var r=function(l,_,u){if(!o.__c.__H)return!0;var d=o.__c.__H.__.filter(function(p){return!!p.__c});if(d.every(function(p){return!p.__N}))return!a||a.call(this,l,_,u);var c=o.__c.props!==l;return d.forEach(function(p){if(p.__N){var m=p.__[0];p.__=p.__N,p.__N=void 0,m!==p.__[0]&&(c=!0)}}),a&&a.call(this,l,_,u)||c};v.__f=!0;var a=v.shouldComponentUpdate,i=v.componentWillUpdate;v.componentWillUpdate=function(l,_,u){if(this.__e){var d=a;a=void 0,r(l,_,u),a=d}i&&i.call(this,l,_,u)},v.shouldComponentUpdate=r}return o.__N||o.__}function N(e,t){var n=z(R++,3);!y.__s&&He(n.__H,t)&&(n.__=e,n.u=t,v.__H.__h.push(n))}function V(e,t){var n=z(R++,4);!y.__s&&He(n.__H,t)&&(n.__=e,n.u=t,v.__h.push(n))}function U(e){return B=5,X(function(){return{current:e}},[])}function ke(e,t,n){B=6,V(function(){if(typeof e=="function"){var o=e(t());return function(){e(null),o&&typeof o=="function"&&o()}}if(e)return e.current=t(),function(){return e.current=null}},n==null?n:n.concat(e))}function X(e,t){var n=z(R++,7);return He(n.__H,t)&&(n.__=e(),n.__H=t,n.__h=e),n.__}function Ce(e,t){return B=8,X(function(){return e},t)}function Ne(e){var t=v.context[e.__c],n=z(R++,9);return n.c=e,t?(n.__==null&&(n.__=!0,t.sub(v)),t.props.value):e.__}function Te(e,t){y.useDebugValue&&y.useDebugValue(t?t(e):e)}function Ee(){var e=z(R++,11);if(!e.__){for(var t=v.__v;t!==null&&!t.__m&&t.__!==null;)t=t.__;var n=t.__m||(t.__m=[0,0]);e.__="P"+n[0]+"-"+n[1]++}return e.__}function vn(){for(var e;e=dt.shift();)if(e.__P&&e.__H)try{e.__H.__h.forEach(ie),e.__H.__h.forEach(Se),e.__H.__h=[]}catch(t){e.__H.__h=[],y.__e(t,e.__v)}}y.__b=function(e){v=null,at&&at(e)},y.__=function(e,t){e&&t.__k&&t.__k.__m&&(e.__m=t.__k.__m),ut&&ut(e,t)},y.__r=function(e){it&&it(e),R=0;var t=(v=e.__c).__H;t&&(xe===v?(t.__h=[],v.__h=[],t.__.forEach(function(n){n.__N&&(n.__=n.__N),n.u=n.__N=void 0})):(t.__h.forEach(ie),t.__h.forEach(Se),t.__h=[],R=0)),xe=v},y.diffed=function(e){lt&&lt(e);var t=e.__c;t&&t.__H&&(t.__H.__h.length&&(dt.push(t)!==1&&rt===y.requestAnimationFrame||((rt=y.requestAnimationFrame)||yn)(vn)),t.__H.__.forEach(function(n){n.u&&(n.__H=n.u),n.u=void 0})),xe=v=null},y.__c=function(e,t){t.some(function(n){try{n.__h.forEach(ie),n.__h=n.__h.filter(function(o){return!o.__||Se(o)})}catch(o){t.some(function(r){r.__h&&(r.__h=[])}),t=[],y.__e(o,n.__v)}}),st&&st(e,t)},y.unmount=function(e){ct&&ct(e);var t,n=e.__c;n&&n.__H&&(n.__H.__.forEach(function(o){try{ie(o)}catch(r){t=r}}),n.__H=void 0,t&&y.__e(t,n.__v))};var _t=typeof requestAnimationFrame=="function";function yn(e){var t,n=function(){clearTimeout(o),_t&&cancelAnimationFrame(t),setTimeout(e)},o=setTimeout(n,35);_t&&(t=requestAnimationFrame(n))}function ie(e){var t=v,n=e.__c;typeof n=="function"&&(e.__c=void 0,n()),v=t}function Se(e){var t=v;e.__c=e.__(),v=t}function He(e,t){return!e||e.length!==t.length||t.some(function(n,o){return n!==e[o]})}function ft(e,t){return typeof t=="function"?t(e):t}var wn={data:""},xn=e=>{if(typeof window=="object"){let t=(e?e.querySelector("#_goober"):window._goober)||Object.assign(document.createElement("style"),{innerHTML:" ",id:"_goober"});return t.nonce=window.__nonce__,t.parentNode||(e||document.head).appendChild(t),t.firstChild}return e||wn};var Sn=/(?:([\u0080-\uFFFF\w-%@]+) *:? *([^{;]+?);|([^;}{]*?) *{)|(}\s*)/g,kn=/\/\*[^]*?\*\/|  +/g,pt=/\n+/g,M=(e,t)=>{let n="",o="",r="";for(let a in e){let i=e[a];a[0]=="@"?a[1]=="i"?n=a+" "+i+";":o+=a[1]=="f"?M(i,a):a+"{"+M(i,a[1]=="k"?"":t)+"}":typeof i=="object"?o+=M(i,t?t.replace(/([^,])+/g,l=>a.replace(/([^,]*:\S+\([^)]*\))|([^,])+/g,_=>/&/.test(_)?_.replace(/&/g,l):l?l+" "+_:_)):a):i!=null&&(a=/^--/.test(a)?a:a.replace(/[A-Z]/g,"-$&").toLowerCase(),r+=M.p?M.p(a,i):a+":"+i+";")}return n+(t&&r?t+"{"+r+"}":r)+o},P={},mt=e=>{if(typeof e=="object"){let t="";for(let n in e)t+=n+mt(e[n]);return t}return e},Cn=(e,t,n,o,r)=>{let a=mt(e),i=P[a]||(P[a]=(_=>{let u=0,d=11;for(;u<_.length;)d=101*d+_.charCodeAt(u++)>>>0;return"go"+d})(a));if(!P[i]){let _=a!==e?e:(u=>{let d,c,p=[{}];for(;d=Sn.exec(u.replace(kn,""));)d[4]?p.shift():d[3]?(c=d[3].replace(pt," ").trim(),p.unshift(p[0][c]=p[0][c]||{})):p[0][d[1]]=d[2].replace(pt," ").trim();return p[0]})(e);P[i]=M(r?{["@keyframes "+i]:_}:_,n?"":"."+i)}let l=n&&P.g?P.g:null;return n&&(P.g=P[i]),((_,u,d,c)=>{c?u.data=u.data.replace(c,_):u.data.indexOf(_)===-1&&(u.data=d?_+u.data:u.data+_)})(P[i],t,o,l),i},Nn=(e,t,n)=>e.reduce((o,r,a)=>{let i=t[a];if(i&&i.call){let l=i(n),_=l&&l.props&&l.props.className||/^go/.test(l)&&l;i=_?"."+_:l&&typeof l=="object"?l.props?"":M(l,""):l===!1?"":l}return o+r+(i??"")},"");function Je(e){let t=this||{},n=e.call?e(t.p):e;return Cn(n.unshift?n.raw?Nn(n,[].slice.call(arguments,1),t.p):n.reduce((o,r)=>Object.assign(o,r&&r.call?r(t.p):r),{}):n,xn(t.target),t.g,t.o,t.k)}var ht,Le,Ie,Vo=Je.bind({g:1}),qo=Je.bind({k:1});function bt(e,t,n,o){M.p=t,ht=e,Le=n,Ie=o}function f(e,t){let n=this||{};return function(){let o=arguments;function r(a,i){let l=Object.assign({},a),_=l.className||r.className;n.p=Object.assign({theme:Le&&Le()},l),n.o=/ *go\d+/.test(_),l.className=Je.apply(n,o)+(_?" "+_:""),t&&(l.ref=i);let u=e;return e[0]&&(u=l.as||e,delete l.as),Ie&&u[0]&&Ie(l),ht(u,l)}return t?t(r):r}}var gt=e=>{let t,n=new Set,o=(u,d)=>{let c=typeof u=="function"?u(t):u;if(!Object.is(c,t)){let p=t;t=d??(typeof c!="object"||c===null)?c:Object.assign({},t,c),n.forEach(m=>m(t,p))}},r=()=>t,l={setState:o,getState:r,getInitialState:()=>_,subscribe:u=>(n.add(u),()=>n.delete(u))},_=t=e(o,r,l);return l},vt=(e=>e?gt(e):gt);function Et(e,t){for(var n in t)e[n]=t[n];return e}function Ae(e,t){for(var n in e)if(n!=="__source"&&!(n in t))return!0;for(var o in t)if(o!=="__source"&&e[o]!==t[o])return!0;return!1}function Ht(e,t){var n=t(),o=D({t:{__:n,u:t}}),r=o[0].t,a=o[1];return V(function(){r.__=n,r.u=t,Pe(r)&&a({t:r})},[e,n,t]),N(function(){return Pe(r)&&a({t:r}),e(function(){Pe(r)&&a({t:r})})},[e]),n}function Pe(e){var t,n,o=e.u,r=e.__;try{var a=o();return!((t=r)===(n=a)&&(t!==0||1/t==1/n)||t!=t&&n!=n)}catch{return!0}}function Lt(e){e()}function It(e){return e}function Jt(){return[!1,Lt]}var Pt=V;function Fe(e,t){this.props=e,this.context=t}function Tn(e,t){function n(r){var a=this.props.ref,i=a==r.ref;return!i&&a&&(a.call?a(null):a.current=null),t?!t(this.props,r)||!i:Ae(this.props,r)}function o(r){return this.shouldComponentUpdate=n,C(e,r)}return o.displayName="Memo("+(e.displayName||e.name)+")",o.prototype.isReactComponent=!0,o.__f=!0,o.type=e,o}(Fe.prototype=new T).isPureReactComponent=!0,Fe.prototype.shouldComponentUpdate=function(e,t){return Ae(this.props,e)||Ae(this.state,t)};var yt=h.__b;h.__b=function(e){e.type&&e.type.__f&&e.ref&&(e.props.ref=e.ref,e.ref=null),yt&&yt(e)};var En=typeof Symbol<"u"&&Symbol.for&&Symbol.for("react.forward_ref")||3911;function Hn(e){function t(n){var o=Et({},n);return delete o.ref,e(o,n.ref||null)}return t.$$typeof=En,t.render=e,t.prototype.isReactComponent=t.__f=!0,t.displayName="ForwardRef("+(e.displayName||e.name)+")",t}var wt=function(e,t){return e==null?null:I(I(e).map(t))},Ln={map:wt,forEach:wt,count:function(e){return e?I(e).length:0},only:function(e){var t=I(e);if(t.length!==1)throw"Children.only";return t[0]},toArray:I},In=h.__e;h.__e=function(e,t,n,o){if(e.then){for(var r,a=t;a=a.__;)if((r=a.__c)&&r.__c)return t.__e==null&&(t.__e=n.__e,t.__k=n.__k),r.__c(e,t)}In(e,t,n,o)};var xt=h.unmount;function At(e,t,n){return e&&(e.__c&&e.__c.__H&&(e.__c.__H.__.forEach(function(o){typeof o.__c=="function"&&o.__c()}),e.__c.__H=null),(e=Et({},e)).__c!=null&&(e.__c.__P===n&&(e.__c.__P=t),e.__c.__e=!0,e.__c=null),e.__k=e.__k&&e.__k.map(function(o){return At(o,t,n)})),e}function Ft(e,t,n){return e&&n&&(e.__v=null,e.__k=e.__k&&e.__k.map(function(o){return Ft(o,t,n)}),e.__c&&e.__c.__P===t&&(e.__e&&n.appendChild(e.__e),e.__c.__e=!0,e.__c.__P=n)),e}function se(){this.__u=0,this.o=null,this.__b=null}function Rt(e){var t=e.__.__c;return t&&t.__a&&t.__a(e)}function Jn(e){var t,n,o,r=null;function a(i){if(t||(t=e()).then(function(l){l&&(r=l.default||l),o=!0},function(l){n=l,o=!0}),n)throw n;if(!o)throw t;return r?C(r,i):null}return a.displayName="Lazy",a.__f=!0,a}function ee(){this.i=null,this.l=null}h.unmount=function(e){var t=e.__c;t&&t.__R&&t.__R(),t&&32&e.__u&&(e.type=null),xt&&xt(e)},(se.prototype=new T).__c=function(e,t){var n=t.__c,o=this;o.o==null&&(o.o=[]),o.o.push(n);var r=Rt(o.__v),a=!1,i=function(){a||(a=!0,n.__R=null,r?r(l):l())};n.__R=i;var l=function(){if(!--o.__u){if(o.state.__a){var _=o.state.__a;o.__v.__k[0]=Ft(_,_.__c.__P,_.__c.__O)}var u;for(o.setState({__a:o.__b=null});u=o.o.pop();)u.forceUpdate()}};o.__u++||32&t.__u||o.setState({__a:o.__b=o.__v.__k[0]}),e.then(i,i)},se.prototype.componentWillUnmount=function(){this.o=[]},se.prototype.render=function(e,t){if(this.__b){if(this.__v.__k){var n=document.createElement("div"),o=this.__v.__k[0].__c;this.__v.__k[0]=At(this.__b,n,o.__O=o.__P)}this.__b=null}var r=t.__a&&C(k,null,e.fallback);return r&&(r.__u&=-33),[C(k,null,t.__a?null:e.children),r]};var St=function(e,t,n){if(++n[1]===n[0]&&e.l.delete(t),e.props.revealOrder&&(e.props.revealOrder[0]!=="t"||!e.l.size))for(n=e.i;n;){for(;n.length>3;)n.pop()();if(n[1]<n[0])break;e.i=n=n[2]}};function Pn(e){return this.getChildContext=function(){return e.context},e.children}function An(e){var t=this,n=e.h;if(t.componentWillUnmount=function(){F(null,t.v),t.v=null,t.h=null},t.h&&t.h!==n&&t.componentWillUnmount(),!t.v){for(var o=t.__v;o!==null&&!o.__m&&o.__!==null;)o=o.__;t.h=n,t.v={nodeType:1,parentNode:n,childNodes:[],__k:{__m:o.__m},contains:function(){return!0},insertBefore:function(r,a){this.childNodes.push(r),t.h.insertBefore(r,a)},removeChild:function(r){this.childNodes.splice(this.childNodes.indexOf(r)>>>1,1),t.h.removeChild(r)}}}F(C(Pn,{context:t.context},e.__v),t.v)}function Fn(e,t){var n=C(An,{__v:e,h:t});return n.containerInfo=t,n}(ee.prototype=new T).__a=function(e){var t=this,n=Rt(t.__v),o=t.l.get(e);return o[0]++,function(r){var a=function(){t.props.revealOrder?(o.push(r),St(t,e,o)):r()};n?n(a):a()}},ee.prototype.render=function(e){this.i=null,this.l=new Map;var t=I(e.children);e.revealOrder&&e.revealOrder[0]==="b"&&t.reverse();for(var n=t.length;n--;)this.l.set(t[n],this.i=[1,0,this.i]);return e.children},ee.prototype.componentDidUpdate=ee.prototype.componentDidMount=function(){var e=this;this.l.forEach(function(t,n){St(e,n,t)})};var Dt=typeof Symbol<"u"&&Symbol.for&&Symbol.for("react.element")||60103,Rn=/^(?:accent|alignment|arabic|baseline|cap|clip(?!PathU)|color|dominant|fill|flood|font|glyph(?!R)|horiz|image(!S)|letter|lighting|marker(?!H|W|U)|overline|paint|pointer|shape|stop|strikethrough|stroke|text(?!L)|transform|underline|unicode|units|v|vector|vert|word|writing|x(?!C))[A-Z]/,Dn=/^on(Ani|Tra|Tou|BeforeInp|Compo)/,Mn=/[A-Z0-9]/g,On=typeof document<"u",$n=function(e){return(typeof Symbol<"u"&&typeof Symbol()=="symbol"?/fil|che|rad/:/fil|che|ra/).test(e)};function Un(e,t,n){return t.__k==null&&(t.textContent=""),F(e,t),typeof n=="function"&&n(),e?e.__c:null}function jn(e,t,n){return ye(e,t),typeof n=="function"&&n(),e?e.__c:null}T.prototype.isReactComponent={},["componentWillMount","componentWillReceiveProps","componentWillUpdate"].forEach(function(e){Object.defineProperty(T.prototype,e,{configurable:!0,get:function(){return this["UNSAFE_"+e]},set:function(t){Object.defineProperty(this,e,{configurable:!0,writable:!0,value:t})}})});var kt=h.event;function Wn(){}function Bn(){return this.cancelBubble}function zn(){return this.defaultPrevented}h.event=function(e){return kt&&(e=kt(e)),e.persist=Wn,e.isPropagationStopped=Bn,e.isDefaultPrevented=zn,e.nativeEvent=e};var Re,Vn={enumerable:!1,configurable:!0,get:function(){return this.class}},Ct=h.vnode;h.vnode=function(e){typeof e.type=="string"&&(function(t){var n=t.props,o=t.type,r={},a=o.indexOf("-")===-1;for(var i in n){var l=n[i];if(!(i==="value"&&"defaultValue"in n&&l==null||On&&i==="children"&&o==="noscript"||i==="class"||i==="className")){var _=i.toLowerCase();i==="defaultValue"&&"value"in n&&n.value==null?i="value":i==="download"&&l===!0?l="":_==="translate"&&l==="no"?l=!1:_[0]==="o"&&_[1]==="n"?_==="ondoubleclick"?i="ondblclick":_!=="onchange"||o!=="input"&&o!=="textarea"||$n(n.type)?_==="onfocus"?i="onfocusin":_==="onblur"?i="onfocusout":Dn.test(i)&&(i=_):_=i="oninput":a&&Rn.test(i)?i=i.replace(Mn,"-$&").toLowerCase():l===null&&(l=void 0),_==="oninput"&&r[i=_]&&(i="oninputCapture"),r[i]=l}}o=="select"&&r.multiple&&Array.isArray(r.value)&&(r.value=I(n.children).forEach(function(u){u.props.selected=r.value.indexOf(u.props.value)!=-1})),o=="select"&&r.defaultValue!=null&&(r.value=I(n.children).forEach(function(u){u.props.selected=r.multiple?r.defaultValue.indexOf(u.props.value)!=-1:r.defaultValue==u.props.value})),n.class&&!n.className?(r.class=n.class,Object.defineProperty(r,"className",Vn)):(n.className&&!n.class||n.class&&n.className)&&(r.class=r.className=n.className),t.props=r})(e),e.$$typeof=Dt,Ct&&Ct(e)};var Nt=h.__r;h.__r=function(e){Nt&&Nt(e),Re=e.__c};var Tt=h.diffed;h.diffed=function(e){Tt&&Tt(e);var t=e.props,n=e.__e;n!=null&&e.type==="textarea"&&"value"in t&&t.value!==n.value&&(n.value=t.value==null?"":t.value),Re=null};var qn={ReactCurrentDispatcher:{current:{readContext:function(e){return Re.__n[e.__c].props.value},useCallback:Ce,useContext:Ne,useDebugValue:Te,useDeferredValue:It,useEffect:N,useId:Ee,useImperativeHandle:ke,useInsertionEffect:Pt,useLayoutEffect:V,useMemo:X,useReducer:le,useRef:U,useState:D,useSyncExternalStore:Ht,useTransition:Jt}}};function Gn(e){return C.bind(null,e)}function ce(e){return!!e&&e.$$typeof===Dt}function Zn(e){return ce(e)&&e.type===k}function Yn(e){return!!e&&!!e.displayName&&(typeof e.displayName=="string"||e.displayName instanceof String)&&e.displayName.startsWith("Memo(")}function Kn(e){return ce(e)?ot.apply(null,arguments):e}function Qn(e){return!!e.__k&&(F(null,e),!0)}function Xn(e){return e&&(e.base||e.nodeType===1&&e)||null}var eo=function(e,t){return e(t)},to=function(e,t){return e(t)},no=k,oo=ce,te={useState:D,useId:Ee,useReducer:le,useEffect:N,useLayoutEffect:V,useInsertionEffect:Pt,useTransition:Jt,useDeferredValue:It,useSyncExternalStore:Ht,startTransition:Lt,useRef:U,useImperativeHandle:ke,useMemo:X,useCallback:Ce,useContext:Ne,useDebugValue:Te,version:"18.3.1",Children:Ln,render:Un,hydrate:jn,unmountComponentAtNode:Qn,createPortal:Fn,createElement:C,createContext:we,createFactory:Gn,cloneElement:Kn,createRef:be,Fragment:k,isValidElement:ce,isElement:oo,isFragment:Zn,isMemo:Yn,findDOMNode:Xn,Component:T,PureComponent:Fe,memo:Tn,forwardRef:Hn,flushSync:to,unstable_batchedUpdates:eo,StrictMode:no,Suspense:se,SuspenseList:ee,lazy:Jn,__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED:qn};var ro=e=>e;function ao(e,t=ro){let n=te.useSyncExternalStore(e.subscribe,te.useCallback(()=>t(e.getState()),[e,t]),te.useCallback(()=>t(e.getInitialState()),[e,t]));return te.useDebugValue(n),n}var Mt=e=>{let t=vt(e),n=o=>ao(t,o);return Object.assign(n,t),n},Ot=(e=>e?Mt(e):Mt);var J={},S=Ot(e=>({jobs:{},selectedJobId:null,showArchived:!1,isPinned:!1,consoleCollapsed:!0,setJobs:t=>e(n=>{let o={};return t.forEach(r=>{o[r.id]={...n.jobs[r.id],...r}}),{jobs:o}}),updateJob:t=>e(n=>({jobs:{...n.jobs,[t.id]:{...n.jobs[t.id],...t}}})),selectJob:(t,n=!0)=>e(o=>{if(t===null)return{selectedJobId:null,isPinned:!1};let r=o.jobs[t];(!J[t]||r&&r.status==="running")&&setTimeout(()=>$t(t),0);let a=o.consoleCollapsed;return r?a=r.status==="success":a=!1,{selectedJobId:t,consoleCollapsed:a,isPinned:n}}),setIsPinned:t=>e({isPinned:t}),deleteJob:t=>e(n=>{let o={...n.jobs};return delete o[t],delete J[t],{jobs:o,selectedJobId:n.selectedJobId===t?null:n.selectedJobId}}),toggleArchived:()=>e(t=>({showArchived:!t.showArchived})),toggleConsole:()=>e(t=>({consoleCollapsed:!t.consoleCollapsed})),setConsoleCollapsed:t=>e({consoleCollapsed:t})}));async function jt(){try{let t=await(await fetch("/api/jobs")).json();S.getState().setJobs(t);let n=t.find(o=>o.status==="running");n&&S.getState().selectJob(n.id)}catch(e){console.error("Initial load failed",e)}}async function Wt(e){try{let t=await fetch(`/api/jobs/${e}`);if(t.ok){let n=await t.json();n&&S.getState().updateJob(n)}}catch(t){console.error(t)}}async function $t(e){try{let t=await fetch(`/api/jobs/${e}/logs`);if(t.ok){let n=await t.text();J[e]=n,window.dispatchEvent(new CustomEvent("job-logs-loaded",{detail:{jobId:e}}))}}catch(t){console.error(t)}}var Ut=null;function De(){let e=location.protocol==="https:"?"wss:":"ws:",t=new WebSocket(e+"//"+location.host+"/ws/state");Ut=t,t.onmessage=n=>{try{if(typeof n.data!="string")return;let o=JSON.parse(n.data);if(o.type==="job_snapshot"&&o.job){let r=o.job,a=S.getState(),i=a.jobs[r.id]?.status;a.updateJob(r),r.id===a.selectedJobId?i==="running"&&r.status==="success"&&a.setConsoleCollapsed(!0):r.status==="running"&&!a.isPinned&&S.getState().selectJob(r.id)}else o.type==="job_log"&&window.dispatchEvent(new CustomEvent("job-log-stream",{detail:o}))}catch(o){console.error(o)}},t.onclose=()=>{Ut=null,setTimeout(De,2e3)}}var io=0;function s(e,t,n,o,r,a){t||(t={});var i,l,_=t;if("ref"in _)for(l in _={},t)l=="ref"?i=t[l]:_[l]=t[l];var u={type:e,props:_,key:n,ref:i,__k:null,__:null,__b:0,__e:null,__c:null,constructor:void 0,__v:--io,__i:-1,__u:0,__source:r,__self:a};if(typeof e=="function"&&(i=e.defaultProps))for(l in i)_[l]===void 0&&(_[l]=i[l]);return h.vnode&&h.vnode(u),u}var Bt=()=>s("header",{children:s(lo,{href:"/",children:s(so,{children:"\u{1F30A} Low Tide"})})}),lo=f("a")`
  text-decoration: none;
  color: inherit;
  cursor: pointer;
`,so=f("h1")`
  font-size: 1.2rem;
  margin: 0;
  font-weight: 800;
  letter-spacing: -0.03em;
`;var co=f("section")`
  grid-column: 1;
`,uo=f("h2")`
  margin: 0;
  border: none;
  padding: 0;
`,zt=f("div")`
  margin-bottom: 1.5rem;
`,_o=f("div")`
  display: flex;
  justify-content: flex-end;
`,Vt=()=>{let e=U(null);return s(co,{className:"lt-card new-job-card",children:[s(uo,{className:"lt-title-section",style:{border:"none"},children:"New Download Job"}),s("form",{ref:e,onSubmit:async n=>{if(n.preventDefault(),!e.current)return;let o=new FormData(e.current),r=await fetch("/api/jobs",{method:"POST",body:o});if(r.ok){e.current.reset();let a=await r.json(),i=0;a.ids&&a.ids.length>0&&(i=a.ids[0]),i&&S.getState().selectJob(i,!1)}},children:[s(zt,{children:[s("label",{className:"lt-label",htmlFor:"app",children:"Downloader"}),s("select",{className:"lt-select",id:"app",name:"app_id",children:[s("option",{value:"auto",children:"Auto-detect"}),window.CONFIG?.apps?.map(n=>s("option",{value:n.id,children:n.name},n.id))]})]}),s(zt,{children:[s("label",{className:"lt-label",htmlFor:"urls",children:"URLs (one per line or space-separated)"}),s("textarea",{className:"lt-textarea",id:"urls",name:"urls",rows:4,placeholder:`https://example.com/file1.mp3
https://example.com/file2.mp3`})]}),s(_o,{children:s("button",{className:"lt-btn",type:"submit",children:"Queue Job"})})]})]})};var qt=f("div")`
  display: grid;
  grid-template-rows: auto 1fr;
  height: 100%;
  overflow: hidden;
`,Gt=f("div")`
  display: flex;
  justify-content: space-between;
  align-items: center;
`,Zt=f("div")`
  max-height: 70vh;
  overflow-y: auto;
  padding-right: 0.5rem;

  &::-webkit-scrollbar {
    width: 6px;
    background: rgba(0,0,0,0.05);
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(0,0,0,0.2);
    border-radius: 3px;
  }
`;var Yt=f("div")`
  padding: 1rem 1.25rem;
  border-radius: var(--border-radius);
  border: 1px solid ${e=>e.selected?"var(--accent2)":"transparent"};
  margin-bottom: 0.75rem;
  cursor: pointer;
  transition: all 0.2s ease;
  background: ${e=>e.selected?"var(--card-bg)":"rgba(0,0,0,0.015)"};
  ${e=>e.selected&&"box-shadow: 0 8px 24px rgba(0,0,0,0.04);"}

  &:hover {
    background: ${e=>e.selected?"var(--card-bg)":"rgba(0,0,0,0.035)"};
  }
`;var fo=f(qt)`
  grid-column: 2;
`,po=f(Zt)``,mo=f(Gt)``,Kt=f("h3")``,ho=f("div")`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex: 1;
  overflow: hidden;
`,bo=f("img")`
  width: 32px;
  height: 32px;
  object-fit: cover;
  border-radius: 4px;
  border: 1px solid var(--border-color);
  background: var(--bg-secondary);
  flex-shrink: 0;
`,go=f("div")`
  width: 32px;
  height: 32px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  flex-shrink: 0;
`,vo=f("div")`
  display: flex;
  align-items: center;
  overflow: hidden;
  flex: 1;
`,yo=f("div")`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`,Qt=({job:e,selected:t})=>{let n=()=>{t?S.getState().selectJob(null):(S.getState().selectJob(e.id),Wt(e.id))},r=e.image_path?`/thumbnails/${e.id}`:null,a=e.title||e.url||e.original_url||`Job #${e.id}`;return s(Yt,{className:"lt-job-item",selected:t,onClick:n,children:s("div",{className:"lt-flex-between",style:{gap:"1.2rem"},children:[s(ho,{children:[r?s(bo,{src:r,alt:a,onError:i=>{i.currentTarget.style.display="none"}}):s(go,{}),s(vo,{children:s(yo,{children:a})})]}),s("div",{className:`lt-pill lt-pill-${e.status}`,children:[e.status==="running"&&s("span",{className:"lt-indicator-dot"}),e.status.toUpperCase()]})]})})},Xt=()=>{let{jobs:e,selectedJobId:t,showArchived:n,toggleArchived:o}=S(),r=Object.values(e).sort((l,_)=>new Date(_.created_at).getTime()-new Date(l.created_at).getTime()),a=r.filter(l=>!l.archived),i=r.filter(l=>l.archived);return s(fo,{className:"lt-card",children:[s(mo,{children:[s("h2",{className:"lt-title-section",style:{border:"none"},children:"Jobs"}),i.length>0&&s("button",{className:"lt-btn lt-btn-secondary lt-btn-sm",onClick:o,children:n?"\u25BE":"\u25B8"})]}),s(po,{className:"lt-mono",children:[s(Kt,{className:"lt-label",children:"Active"}),a.map(l=>s(Qt,{job:l,selected:t===l.id},l.id)),n&&s("section",{style:{marginTop:"1.5rem"},children:[s(Kt,{className:"lt-label",children:"Archived"}),i.map(l=>s(Qt,{job:l,selected:t===l.id},l.id))]})]})]})};var en=({jobId:e})=>{let t=U(null),n=()=>{let r=t.current?.parentElement;r&&(r.scrollTop=r.scrollHeight)},o=()=>{let r=t.current?.parentElement;return r?r.scrollHeight-r.scrollTop-r.clientHeight<50:!1};return N(()=>{if(!t.current)return;let r=J[e]||"";r&&(t.current.innerHTML=r,n())},[e]),N(()=>{let r=i=>{if(i.detail.job_id===e&&t.current){let l=i.detail;if(l.lines){let _=o();for(let[u,d]of Object.entries(l.lines)){let c=parseInt(u),p=t.current.querySelector(`[data-line="${c}"]`);p?p.outerHTML=d:t.current.insertAdjacentHTML("beforeend",d)}J[e]=t.current.innerHTML,_&&n()}}},a=i=>{i.detail.jobId===e&&t.current&&(t.current.innerHTML=J[e]||"",n())};return window.addEventListener("job-log-stream",r),window.addEventListener("job-logs-loaded",a),()=>{window.removeEventListener("job-log-stream",r),window.removeEventListener("job-logs-loaded",a)}},[e]),s("div",{ref:t,className:"lt-terminal"})};function Me(e){if(e===void 0)return"";let t=Number(e);if(t<1024)return t+" B";let n=t/1024;if(n<1024)return Math.round(n)+" KB";let o=n/1024;if(o<1024)return Math.round(o)+" MB";let r=o/1024;return Math.round(r)+" GB"}var tn=f("div")`
  overflow: hidden;
  background: var(--input-bg);
  border-radius: var(--border-radius);
  border: 1px solid var(--border-color);
`,Oe=f("div")`
  display: grid;
  grid-template-columns: ${e=>e.columns||"1fr 120px 100px"};
  align-items: center;
  padding: ${e=>e.isHeader?"0.8rem 1.25rem":"0.9rem 1.25rem"};
  font-size: ${e=>e.isHeader?"0.7rem":"0.9rem"};
  text-transform: ${e=>e.isHeader?"uppercase":"none"};
  font-weight: ${e=>e.isHeader?"800":"normal"};
  color: ${e=>e.isHeader?"var(--muted)":"inherit"};
  background: ${e=>e.isHeader?"rgba(0,0,0,0.02)":"transparent"};
  border-bottom: 1px solid var(--border-color);
  transition: background-color 0.2s;

  ${e=>!e.isHeader&&`
    &:hover { background: rgba(0,0,0,0.02); }
    &:last-child { border-bottom: none; }
  `}
`,nn=f("div")`
  max-height: 320px;
  overflow-y: auto;

  &::-webkit-scrollbar {
    width: 6px;
    background: rgba(0,0,0,0.05);
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(0,0,0,0.2);
    border-radius: 3px;
  }
`,on=f("div")`
  padding: 1rem 1.25rem;
  background: rgba(0,0,0,0.02);
  border-top: 1px solid var(--border-color);
  display: flex;
  justify-content: flex-end;
`;var rn=f("section")`
  margin-bottom: 2.5rem;
`,an=f("div")`
  padding: 1rem;
  text-align: center;
  background: var(--input-bg);
  border-radius: var(--border-radius);
  border: 1px dashed var(--border-color);
  color: var(--muted);
`,wo=f("div")`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.75rem;
  background: var(--input-bg);
  border-radius: var(--border-radius);
  border: 1px solid var(--border-color);
`,ln=({job:e})=>{let t=e.files||[],{status:n,id:o}=e,r=t.length>0,a=n==="cleaned";return n==="queued"?s(rn,{children:s(an,{children:"Job hasn't started yet"})}):!r&&(n==="running"||n==="failed")?null:s(rn,{className:"lt-file-manifest",children:r?t.length===1?s(xo,{file:t[0],jobId:o,isCleaned:a}):s(So,{files:t,jobId:o,isCleaned:a}):s(an,{children:a?"Files have been cleaned":"No files available"})})},xo=({file:e,jobId:t,isCleaned:n})=>s(wo,{className:"lt-file-hero",children:[s("div",{style:{display:"flex",alignItems:"center",gap:"1.25rem"},children:[s("div",{style:{fontSize:"2.2rem"},children:"\u{1F4C4}"}),s("div",{children:[s("div",{style:{fontWeight:700,fontSize:"1.05rem"},children:e.path.split("/").pop()}),s("div",{className:"lt-meta",style:{marginTop:"0.2rem"},children:Me(e.size_bytes)})]})]}),!n&&s("button",{className:"lt-btn lt-btn-success",onClick:()=>window.location.href=`/api/jobs/${t}/files/${e.id}`,children:"Download"})]}),So=({files:e,jobId:t,isCleaned:n})=>s(tn,{className:"lt-file-grid",children:[s(Oe,{isHeader:!0,className:"lt-file-grid-header",children:[s("div",{children:"Name"}),s("div",{children:"Size"}),s("div",{className:"lt-text-right",children:"Actions"})]}),s(nn,{className:"lt-scrollable",children:e.map(o=>s(Oe,{children:[s("div",{style:{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontWeight:600},children:o.path.split("/").pop()}),s("div",{className:"lt-meta",children:Me(o.size_bytes)}),s("div",{className:"lt-text-right",children:!n&&s("a",{href:`/api/jobs/${t}/files/${o.id}`,style:{color:"var(--accent2)",textDecoration:"none",fontSize:"0.75rem",fontWeight:800},children:"GET"})})]},o.id))}),!n&&s(on,{children:s("button",{className:"lt-btn lt-btn-success lt-btn-sm",onClick:()=>window.location.href=`/api/jobs/${t}/zip`,children:"Download All"})})]});var ko=f("div")`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 2rem;
  position: relative;
`,Co=f("div")`
  display: flex;
  align-items: flex-start;
  gap: 1.5rem;
  flex: 1;
`,No=f("img")`
  width: 80px;
  height: 80px;
  object-fit: cover;
  border-radius: var(--border-radius);
  border: 1px solid var(--border-color);
  background: var(--bg-secondary);
  flex-shrink: 0;
`,To=f("div")`
  width: 80px;
  height: 80px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--fg-muted);
  font-size: 0.75rem;
  text-align: center;
  flex-shrink: 0;
`,Eo=f("div")`
  display: flex;
  flex-direction: column;
`,Ho=f("div")`
  display: flex;
  align-items: center;
  gap: 0.8rem;
`,Lo=f("h2")`
  font-size: 1.8rem;
  color: var(--fg);
  letter-spacing: -0.02em;
  text-transform: none;
  margin: 0;
  font-weight: 800;
`,Io=f("div")`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: var(--muted);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  z-index: 10;
  margin-right: 0.5rem;

  .lt-running-text {
    display: none;
  }
`,Jo=f("div")`
  /* Default theme styling - will be overridden by CSS themes */
  display: flex;
  flex-shrink: 0;
`,Po=f("div")`
  display: flex;
  gap: 0.75rem;
  align-items: center;
`,sn=({job:e})=>{let t=e.title||e.url||e.original_url||`#${e.id}`,n=()=>{J[e.id]="",window.dispatchEvent(new CustomEvent("job-logs-loaded",{detail:{jobId:e.id}})),fetch(`/api/jobs/${e.id}/retry`,{method:"POST"}),S.getState().setConsoleCollapsed(!1)},o=()=>fetch(`/api/jobs/${e.id}/cancel`,{method:"POST"}),r=()=>fetch(`/api/jobs/${e.id}/archive`,{method:"POST"}),a=()=>{confirm("\u26A0\uFE0F Cleanup files? this will delete the files on disk")&&fetch(`/api/jobs/${e.id}/cleanup`,{method:"POST"})},l=(e.files||[]).length>0,u=e.image_path?`/thumbnails/${e.id}`:null;return s(ko,{className:"lt-pane-header",children:[s(Co,{className:"lt-header-content",children:[s(Jo,{className:"lt-job-image-container",children:u?s(No,{className:"lt-job-image",src:u,alt:t,onError:d=>{d.currentTarget.style.display="none"}}):s(To,{className:"lt-job-image-placeholder",children:"No Image"})}),s(Eo,{className:"pane-title-group",children:[s(Ho,{children:s(Lo,{children:t})}),s("div",{className:"lt-meta lt-job-header-metadata",style:{marginTop:"0.4rem"},children:s("span",{children:["Entry #",e.id," \u2022 ",new Date(e.created_at).toLocaleString()]})})]})]}),s(Po,{className:"lt-job-actions",children:[e.status==="running"&&s(Io,{className:"lt-running-indicator",title:"Downloading",children:[s("span",{className:"lt-indicator-dot"}),s("span",{className:"lt-running-text",children:"Downloading"})]}),e.original_url&&s("button",{className:"lt-btn lt-btn-secondary lt-btn-sm",onClick:()=>window.open(e.original_url,"_blank"),children:"Source"}),!e.archived&&(e.status=="success"||e.status=="failed"||e.status==="cancelled")&&s("button",{className:"lt-btn lt-btn-secondary lt-btn-sm",onClick:r,children:"Archive"}),l&&(e.status=="success"||e.status=="failed"||e.status==="cancelled")&&s("button",{className:"lt-btn lt-btn-secondary lt-btn-danger lt-btn-sm",onClick:a,children:"Cleanup"}),e.status==="running"&&s("button",{className:"lt-btn lt-btn-secondary lt-btn-danger lt-btn-sm",onClick:o,children:"Cancel"}),(e.status==="failed"||e.status==="cancelled"||e.status==="cleaned")&&s("button",{className:"lt-btn lt-btn-secondary lt-btn-sm",onClick:n,children:e.status==="cleaned"?"Download again":"Retry"})]})]})};var Ao=f("section")`
  grid-column: 1 / -1;
`,Fo=f("section")`
  margin-top: 2rem;
`,Ro=f("div")`
  display: flex;
  justify-content: space-between;
  align-items: center;
`,Do=f("div")`
  background: var(--term-bg);
  border-radius: var(--border-radius);
  font-size: 0.9rem;
  overflow: auto;
  color: var(--term-fg);
  line-height: 1.6;
  font-family: var(--font-mono);
  transition: all 0.3s ease-in-out;
  border: ${e=>e.collapsed?"none !important":"1px solid var(--border-color)"};
  height: ${e=>e.collapsed?"0":"400px"};
  padding: ${e=>e.collapsed?"0":"1.5rem"};
  margin-top: ${e=>e.collapsed?"0":"1rem"};
`,cn=()=>{let{jobs:e,selectedJobId:t,consoleCollapsed:n,toggleConsole:o}=S(),r=t?e[t]:null;return r?s(Ao,{className:"lt-card",children:[s(sn,{job:r}),s(ln,{job:r}),r.status!=="queued"&&s(Fo,{children:[s(Ro,{className:"lt-flex-between",children:[s("h3",{className:"lt-title-section",style:{border:"none"},children:"LOGS"}),r.status!=="failed"&&s("button",{className:"lt-btn lt-btn-secondary lt-btn-sm",onClick:o,children:n?"SHOW LOGS":"CLOSE LOGS"})]}),s(Do,{collapsed:n,className:"lt-log-view",children:s(en,{jobId:r.id})})]})]}):null};var Mo=[{id:"archivist",name:"The Archivist"},{id:"midnight-vinyl",name:"Midnight Vinyl"},{id:"the-broadcaster",name:"The Broadcaster"}],un=()=>{let[e,t]=D("archivist");return N(()=>{let o=localStorage.getItem("theme")||"archivist";t(o),document.body.setAttribute("data-theme",o)},[]),s(Oo,{children:[s("label",{className:"lt-label",style:{margin:0,fontSize:"0.65rem"},htmlFor:"theme-switcher",children:"Surface"}),s($o,{id:"theme-switcher",onChange:o=>{let r=o.currentTarget.value;t(r),document.body.setAttribute("data-theme",r),localStorage.setItem("theme",r)},value:e,className:"lt-select",children:Mo.map(o=>s("option",{value:o.id,children:o.name},o.id))})]})},Oo=f("div")`
  display: flex;
  align-items: center;
  gap: 0.75rem;
`,$o=f("select")`
  appearance: none;
  padding: 0.2rem 0.6rem;
`;var $e=[{latin:"Utere legitime.",english:"Use lawfully."},{latin:"Ad usum legitimum tantum.",english:"For lawful use only."},{latin:"Responsabilitas penes usorem.",english:"Responsibility lies with the user."},{latin:"Ars technica, non culpa.",english:"A technical tool, not a crime."},{latin:"Fac quod licet.",english:"Do what is permitted."},{latin:"Liberare data, liberare mentes.",english:"Free the data, free the minds."},{latin:"Nullus dominus, nullum archivum clausum.",english:"No masters, no locked archives."},{latin:"Mare liberum, data libera.",english:"The sea is free, the data is free."},{latin:"Omnia communia.",english:"Everything is shared."},{latin:"Si potes legere, potes capere.",english:"If you can read it, you can take it."},{latin:"Ubi copia, ibi gaudium.",english:"Where there are copies, there is joy."},{latin:"Copia non furta est.",english:"Copying is not theft."}],_n=()=>{let[e,t]=D($e[0]);return N(()=>{let n=$e[Math.floor(Math.random()*$e.length)];t(n)},[]),s("footer",{children:[s(Uo,{title:e.english,children:["\u201C",e.latin,"\u201D"]}),s(un,{})]})},Uo=f("span")`
  font-style: italic;
  font-family: var(--font-main);
  opacity: 0.8;
`;bt(C);var jo=()=>(N(()=>{jt(),De()},[]),s(k,{children:[s(Bt,{}),s("main",{children:[s(Vt,{}),s(Xt,{}),s(cn,{})]}),s(_n,{})]})),dn=document.getElementById("app");dn&&F(s(jo,{}),dn);})();
