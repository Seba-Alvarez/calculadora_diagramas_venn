// sets base fijos
const SET_A = new Set([1, 4, 6, 7]);
const SET_B = new Set([2, 4, 5, 7]);
const SET_C = new Set([3, 5, 6, 7]);

// Funciones para operaciones con sets
function intersection(...sets) {
  return sets.reduce((acc, set) => new Set([...acc].filter(x => set.has(x))));
}
function difference(setA, ...sets) {
  let diff = new Set(setA);
  for (const s of sets) {
    for (const elem of s) diff.delete(elem);
  }
  return diff;
}

// Parser expresión (igual a Python pero en JS)
class SetExpr {
  constructor(A, B, C) {
    this.env = { A: A, B: B, C: C };
    this.U = new Set([...A, ...B, ...C]);
    this.toks = [];
    this.i = 0;
  }


  _tok(s) {
  // Reemplazo símbolos por palabras clave
  s = s.replace(/∩|&/g, ' INT ');
  s = s.replace(/∪|\+|\|/g, ' OR ');
  s = s.replace(/△|\^/g, ' XOR ');
  s = s.replace(/[-\\]/g, ' NOT ');  // FIX aquí

  // Complemento: Aᶜ, (A∪B)ᶜ, etc.
  s = s.replace(/([A-C\)\]])[\ᶜ\^']/g, ' NOT $1');  // FIX aquí

  // Espacios en paréntesis
  s = s.replace(/([\(\)])/g, ' $1 ');

  const rawTokens = s.trim().split(/\s+/);
  this.toks = rawTokens.map(t => {
    const tl = t.toUpperCase();
    if (['A','B','C','(',')','INT','OR','XOR','NOT'].includes(tl)) {
      return tl;
    }
    console.log("Raw tokens:", rawTokens);
    throw new Error(`Token no reconocido: ${t}`);
  });
  this.i = 0;
}

  _peek() {
    return this.toks[this.i] || null;
  }
  _take(x=null) {
    const tok = this._peek();
    if (tok === null) return null;
    if (x && tok !== x) throw new Error(`Se esperaba ${x}, llegó ${tok}`);
    this.i++;
    return tok;
  }

  parse(s) {
    this._tok(s);
    console.log("Tokens crudos:", this.toks);
    const res = this._xor();
    if (this._peek() !== null) throw new Error("Sobran tokens");
    return res;
  }

  _xor() {
    let L = this._union();
    while (this._peek() === 'XOR') {
      this._take('XOR');
      let R = this._union();
      // XOR = (L ∪ R) - (L ∩ R)
      L = new Set([...new Set([...L, ...R])].filter(x => !(L.has(x) && R.has(x))));
    }
    return L;
  }

  _union() {
    let L = this._diff();
    while (this._peek() === 'OR') {
      this._take('OR');
      let R = this._diff();
      L = new Set([...L, ...R]);
    }
    return L;
  }

  _diff() {
    let L = this._inter();
    while (this._peek() === 'NOT') {
      this._take('NOT');
      let R = this._inter();
      L = difference(L, R);
    }
    return L;
  }

  _inter() {
    let res = this._unary();
    while (this._peek() === 'INT') {
      this._take('INT');
      let r = this._unary();
      res = intersection(res, r);
    }
    return res;
  }

  _unary() {
    if (this._peek() === 'NOT') {
      this._take('NOT');
      let X = this._unary();
      return difference(this.U, X);
    }
    return this._prim();
  }

  _prim() {
    const t = this._peek();
    if (['A','B','C'].includes(t)) {
      this._take();
      return this.env[t];
    }
    if (t === '(') {
      this._take('(');
      let x = this._xor();
      this._take(')');
      return x;
    }
    throw new Error("Se esperaba A, B, C o '('");
  }
}

// Función para calcular tamaño de regiones para venn.js
function calcularRegiones() {
  // Retornamos array con los 7 tamaños (venn.js espera este orden):
  // [A, B, AB, C, AC, BC, ABC]
  const A_only = difference(SET_A, SET_B, SET_C).size;
  const B_only = difference(SET_B, SET_A, SET_C).size;
  const AB = difference(intersection(SET_A, SET_B), SET_C).size;
  const C_only = difference(SET_C, SET_A, SET_B).size;
  const AC = difference(intersection(SET_A, SET_C), SET_B).size;
  const BC = difference(intersection(SET_B, SET_C), SET_A).size;
  const ABC = intersection(SET_A, SET_B, SET_C).size;

  return [A_only, B_only, AB, C_only, AC, BC, ABC];
}

function drawVennDiagram(exprResultSet) {
  d3.select("#venn").selectAll("*").remove();

  const sizes = calcularRegiones();

  // Data para venn.js: seteamos los labels A, B, C con sus tamaños individuales y sus intersecciones
  const setsData = [
    { sets: ['A'], size: sizes[0] + sizes[2] + sizes[4] + sizes[6] }, // A = A_only + AB + AC + ABC
    { sets: ['B'], size: sizes[1] + sizes[2] + sizes[5] + sizes[6] }, // B = B_only + AB + BC + ABC
    { sets: ['C'], size: sizes[3] + sizes[4] + sizes[5] + sizes[6] }, // C = C_only + AC + BC + ABC
    { sets: ['A', 'B'], size: sizes[2] + sizes[6] }, // AB = AB + ABC
    { sets: ['A', 'C'], size: sizes[4] + sizes[6] }, // AC = AC + ABC
    { sets: ['B', 'C'], size: sizes[5] + sizes[6] }, // BC = BC + ABC
    { sets: ['A', 'B', 'C'], size: sizes[6] }       // ABC
  ];

  console.log("Datos para venn.js:", setsData);

  const chart = venn.VennDiagram();
  d3.select("#venn")
    .datum(setsData)
    .call(chart);

    console.log("Pintando regiones:");
  d3.select("#venn").selectAll("g").each(function(d) {
    console.log(d.sets);
  });

    d3.select("#venn").selectAll("path")
    .style("fill", "#ddd")
    .style("fill-opacity", 1)
    .style("stroke", "black")
    .style("stroke-width", 2);

    // función actual para crear sets y dibujar los diagramas
const regionesDisjuntas = {
  'A': difference(SET_A, SET_B, SET_C),
  'B': difference(SET_B, SET_A, SET_C),
  'AB': difference(intersection(SET_A, SET_B), SET_C),
  'C': difference(SET_C, SET_A, SET_B),
  'AC': difference(intersection(SET_A, SET_C), SET_B),
  'BC': difference(intersection(SET_B, SET_C), SET_A),
  'ABC': intersection(SET_A, SET_B, SET_C)
};

  d3.select("#venn").selectAll("g")
  .filter(d => {
    const setsKey = d.sets.slice().sort().join('');
    const regionElems = regionesDisjuntas[setsKey];

    if (!regionElems) return false;

    const interseccion = new Set([...regionElems].filter(x => exprResultSet.has(x)));
    
    console.log(`Región ${setsKey}: tamaño región ${regionElems.size}, tamaño intersección ${interseccion.size}`);

    return interseccion.size === regionElems.size;
  })
   .select("path")
    .style("fill", "#ffcc00")
    .style("fill-opacity", 1);


}

// Funciones para el UI
function appendSymbol(sym) {
  const bar = document.getElementById("expressionBar");
  bar.textContent += sym;
}

function clearExpression() {
  const bar = document.getElementById("expressionBar");
  bar.textContent = "";
  // Limpio diagrama
  d3.select("#venn").selectAll("*").remove();
}

function evaluateExpression() {
  const bar = document.getElementById("expressionBar");
  const expr = bar.textContent.trim();

  if (!expr) {
    alert("Por favor, ingrese una expresión.");
    return;
  }

  console.log("Dibujando expresión:", expr);

  try {
    const parser = new SetExpr(SET_A, SET_B, SET_C);
    const resultSet = parser.parse(expr);

    console.log("Expr original:", expr);
    console.log("Conjunto resultante:", Array.from(resultSet));

    drawVennDiagram(resultSet);
  } catch(e) {
    alert("Error en la expresión: " + e.message);
    console.error(e);
  }
}

const toggleBtn = document.getElementById('toggle-glossary');
const glossaryPanel = document.getElementById('glossary-panel');

toggleBtn.addEventListener('click', () => {
  glossaryPanel.classList.toggle('active');
  toggleBtn.classList.toggle('active');
});
