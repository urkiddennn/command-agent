import{ab as S,a3 as z,aG as H,C as Z,n as q,o as J,s as K,g as Q,c as X,b as Y,_ as g,l as F,t as tt,d as et,D as at,H as rt,P as nt,k as it}from"./Mermaid.js";import{p as st}from"./chunk-4BX2VUAB.js";import{p as lt}from"./mermaid-parser.core.js";import{d as I}from"./arc.js";import{o as ot}from"./ordinal.js";import"./webview.js";import"./_baseUniq.js";import"./_basePickBy.js";import"./clone.js";import"./init.js";function ct(t,a){return a<t?-1:a>t?1:a>=t?0:NaN}function ut(t){return t}function pt(){var t=ut,a=ct,f=null,x=S(0),s=S(z),o=S(0);function l(e){var n,c=(e=H(e)).length,u,y,h=0,p=new Array(c),i=new Array(c),v=+x.apply(this,arguments),w=Math.min(z,Math.max(-z,s.apply(this,arguments)-v)),m,C=Math.min(Math.abs(w)/c,o.apply(this,arguments)),$=C*(w<0?-1:1),d;for(n=0;n<c;++n)(d=i[p[n]=n]=+t(e[n],n,e))>0&&(h+=d);for(a!=null?p.sort(function(A,D){return a(i[A],i[D])}):f!=null&&p.sort(function(A,D){return f(e[A],e[D])}),n=0,y=h?(w-c*$)/h:0;n<c;++n,v=m)u=p[n],d=i[u],m=v+(d>0?d*y:0)+$,i[u]={data:e[u],index:n,value:d,startAngle:v,endAngle:m,padAngle:C};return i}return l.value=function(e){return arguments.length?(t=typeof e=="function"?e:S(+e),l):t},l.sortValues=function(e){return arguments.length?(a=e,f=null,l):a},l.sort=function(e){return arguments.length?(f=e,a=null,l):f},l.startAngle=function(e){return arguments.length?(x=typeof e=="function"?e:S(+e),l):x},l.endAngle=function(e){return arguments.length?(s=typeof e=="function"?e:S(+e),l):s},l.padAngle=function(e){return arguments.length?(o=typeof e=="function"?e:S(+e),l):o},l}var L=Z.pie,G={sections:new Map,showData:!1,config:L},T=G.sections,N=G.showData,gt=structuredClone(L),dt=g(()=>structuredClone(gt),"getConfig"),ft=g(()=>{T=new Map,N=G.showData,tt()},"clear"),mt=g(({label:t,value:a})=>{if(a<0)throw new Error(`"${t}" has invalid value: ${a}. Negative values are not allowed in pie charts. All slice values must be >= 0.`);T.has(t)||(T.set(t,a),F.debug(`added new section: ${t}, with value: ${a}`))},"addSection"),ht=g(()=>T,"getSections"),vt=g(t=>{N=t},"setShowData"),St=g(()=>N,"getShowData"),_={getConfig:dt,clear:ft,setDiagramTitle:q,getDiagramTitle:J,setAccTitle:K,getAccTitle:Q,setAccDescription:X,getAccDescription:Y,addSection:mt,getSections:ht,setShowData:vt,getShowData:St},xt=g((t,a)=>{st(t,a),a.setShowData(t.showData),t.sections.map(a.addSection)},"populateDb"),yt={parse:g(async t=>{const a=await lt("pie",t);F.debug(a),xt(a,_)},"parse")},wt=g(t=>`
  .pieCircle{
    stroke: ${t.pieStrokeColor};
    stroke-width : ${t.pieStrokeWidth};
    opacity : ${t.pieOpacity};
  }
  .pieOuterCircle{
    stroke: ${t.pieOuterStrokeColor};
    stroke-width: ${t.pieOuterStrokeWidth};
    fill: none;
  }
  .pieTitleText {
    text-anchor: middle;
    font-size: ${t.pieTitleTextSize};
    fill: ${t.pieTitleTextColor};
    font-family: ${t.fontFamily};
  }
  .slice {
    font-family: ${t.fontFamily};
    fill: ${t.pieSectionTextColor};
    font-size:${t.pieSectionTextSize};
    // fill: white;
  }
  .legend text {
    fill: ${t.pieLegendTextColor};
    font-family: ${t.fontFamily};
    font-size: ${t.pieLegendTextSize};
  }
`,"getStyles"),At=wt,Dt=g(t=>{const a=[...t.values()].reduce((s,o)=>s+o,0),f=[...t.entries()].map(([s,o])=>({label:s,value:o})).filter(s=>s.value/a*100>=1).sort((s,o)=>o.value-s.value);return pt().value(s=>s.value)(f)},"createPieArcs"),Ct=g((t,a,f,x)=>{F.debug(`rendering pie chart
`+t);const s=x.db,o=et(),l=at(s.getConfig(),o.pie),e=40,n=18,c=4,u=450,y=u,h=rt(a),p=h.append("g");p.attr("transform","translate("+y/2+","+u/2+")");const{themeVariables:i}=o;let[v]=nt(i.pieOuterStrokeWidth);v??(v=2);const w=l.textPosition,m=Math.min(y,u)/2-e,C=I().innerRadius(0).outerRadius(m),$=I().innerRadius(m*w).outerRadius(m*w);p.append("circle").attr("cx",0).attr("cy",0).attr("r",m+v/2).attr("class","pieOuterCircle");const d=s.getSections(),A=Dt(d),D=[i.pie1,i.pie2,i.pie3,i.pie4,i.pie5,i.pie6,i.pie7,i.pie8,i.pie9,i.pie10,i.pie11,i.pie12];let b=0;d.forEach(r=>{b+=r});const P=A.filter(r=>(r.data.value/b*100).toFixed(0)!=="0"),k=ot(D);p.selectAll("mySlices").data(P).enter().append("path").attr("d",C).attr("fill",r=>k(r.data.label)).attr("class","pieCircle"),p.selectAll("mySlices").data(P).enter().append("text").text(r=>(r.data.value/b*100).toFixed(0)+"%").attr("transform",r=>"translate("+$.centroid(r)+")").style("text-anchor","middle").attr("class","slice"),p.append("text").text(s.getDiagramTitle()).attr("x",0).attr("y",-(u-50)/2).attr("class","pieTitleText");const W=[...d.entries()].map(([r,M])=>({label:r,value:M})),E=p.selectAll(".legend").data(W).enter().append("g").attr("class","legend").attr("transform",(r,M)=>{const R=n+c,V=R*W.length/2,U=12*n,j=M*R-V;return"translate("+U+","+j+")"});E.append("rect").attr("width",n).attr("height",n).style("fill",r=>k(r.label)).style("stroke",r=>k(r.label)),E.append("text").attr("x",n+c).attr("y",n-c).text(r=>s.getShowData()?`${r.label} [${r.value}]`:r.label);const B=Math.max(...E.selectAll("text").nodes().map(r=>(r==null?void 0:r.getBoundingClientRect().width)??0)),O=y+e+n+c+B;h.attr("viewBox",`0 0 ${O} ${u}`),it(h,u,O,l.useMaxWidth)},"draw"),$t={draw:Ct},Wt={parser:yt,db:_,renderer:$t,styles:At};export{Wt as diagram};
