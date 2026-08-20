# 01 — Pipeline map: how the index computation flows through FORM, LiE, and Mathematica

*Date: 2026-08-12 · wiki pages used: [[superconformal-index]], [[4d-n1-scft-landscape]] · references: [arXiv:2408.02953]*

All line numbers refer to `refs/landscape_refactored.py`.

## Goal

Reconstruct the full data flow of the index pipeline (scope (b)+(c)) with each stage's
exact input/output format, and trace toy examples through every stage, verifying the
decoded output against the analytic plethystic exponential. Verify criterion: toy
index matches the analytic PE; post-processing outputs match hand-derived expectations.

## Setup

Index convention: $\mathcal I(t,y;x)=\mathrm{Tr}(-1)^F t^{3(R+2j_1)}y^{2j_2}x^f$.
Single letters: chiral scalar $\phi$: $t^{3r}\chi_{\mathcal R}(g)$; its conjugate
fermion $\bar\psi$: $-t^{3(2-r)}\chi_{\bar{\mathcal R}}(g)$ (no $y$); vector multiplet:
$(-t^3y-t^3/y+2t^6)\chi_{\rm adj}(g)$; each letter multiplied by the descendant factor
$J=1/[(1-t^3y)(1-t^3/y)]$. Index = PE of the total single-letter index, projected onto
gauge singlets.

## Stage 0 — input format

`r_list`: 15 entries `[name, [R-charges], [U(1)-charge vectors]]`, one per species
name `X, M, q, qb, phi, S, Sb, A, Ab, U, Ub, V, Vb, W, Wb` (built in `charges2`,
lines 1178-1187). Absent species keep empty lists but **must be present**: `makefrm`
declares FORM function symbols from all names, and the vector-multiplet term
references `phi` (line 283), so a truncated list is a FORM error ("Undeclared
variable phi"). The two lists inside an entry are parallel (one U(1) vector per
field) — `single()` indexes `g_list[i]` for every R-charge `i` (line 155). Species
positions map to representations via `MU_DICT`/`DIM_DICT` (lines 52-65): `X, M`
gauge singlets (flip fields), `q/qb` (anti)fundamental, `phi` adjoint, `S/A/U/V/W`
rank-2 tensors. R-charges arrive as ~30-significant-digit decimal strings from the
Mathematica charge computation (`_round30`, line 116).

## Stage 1 — `makefrm` (212-328): generate the FORM script

- **Fugacity encoding** (`single`, 149-171): FORM needs integer exponents, so the
  physical exponent $p$ of $t$ is stored as $t^{d_0}s^{d_1}r^{d_2}$ with
  $d_0=\lfloor 500p\rfloor$, $d_1=\lfloor(500p\bmod 1)\cdot5000\rfloor$,
  $d_2=\mathrm{round}((\dots)\bmod 1\cdot5000)$ — i.e. $500p$ in base-5000 digits.
  $d_0,d_1$ use `int()` truncation, $d_2$ uses ROUND_HALF_UP (asymmetry — step 4).
  Scalar letter: `+g1^q1*..*X1*t^d0*s^d1*r^d2` at $p=3r$; conjugate fermion:
  `-g1^-q1*..*X1^(-1)*...` at $p=6-3r$. $U(1)$ charges ride along as powers of
  `g1, g2, ...`.
- **Expansion orders** (`get_order`, 136-147): species order =
  $\lceil\max_i \max(t_{\rm ord}/3r_i,\, t_{\rm ord}/(6-3r_i))\rceil$ = number of
  Adams (plethystic) terms needed to reach $t^{t_{\rm ord}}$. If the max over species
  exceeds 40 → `"stop"` (routed to the "too small Rcharge" failure path by callers).
  Note both branches of the `if/else` at 216-219 are identical (dead branch).
- **Descendants**: `L J = sum_(idx1,0,N,m^idx1)*sum_(idx2,0,N,n^idx2)` with
  `m=t^1500*y, n=t^1500/y` (304-306): the truncated $J$ factor, applied per letter
  inside each `id K... = J*(letter)` rule.
- **PE structure**: `itotal` $=\sum_{\rm species}\sum_{j=1}^{\rm ord}
  \big(K_i(t^j,s^j,r^j,y^j,\{X^j\})\,\chi_i(j)+\bar K_i(\dots)\,\bar\chi_i(j)\big)/j$;
  species 0,1 (`X,M`) carry no character function (232-254), species ≥2 carry the
  placeholder `name(j)` = Adams-$j$ character of the rep (256-277); `Kvec` adds the
  vector multiplet `-t^1500*y-t^1500/y+2*t^3000` with `phi(j)` (279-284). The
  exponential is expanded by a Horner loop in `z` (313-318),
  $e^x = 1+x(1+\tfrac x2(1+\tfrac x3(\cdots)))$, to `max_order`; powers of `t` are
  truncated at `t(: 500*t_order)` in the symbol declaration (299). Characters are
  declared as commuting functions with `Polyratfun d` rational coefficients (289).
  Output script: `~/frm/index{pid}.frm`.

## Stage 2 — `form` (331-346): run FORM

`form -q index{pid}.frm`, 600 s timeout. stdout is string-cleaned (strip spaces,
newlines, `result=`, backslashes; `z`→`1` — the leftover innermost Horner variable;
`[:-1]` drops the trailing `;`) and written to `~/frm/form{pid}.txt`. Observed toy
output format — a `+`-separated sum, every coefficient a `d(num,den)` rational:

```
t^1000*X1*d(1,1)+d(1,1)+phi(1)*y^-1*t^1500*d(-1,1)+phi(1)*y*t^1500*d(-1,1)
```

## Stage 3 — `Mathcode`/`match` (351-576): decode + gauge-singlet projection

`Mathcode` splits the FORM output on `+` (minus signs stay inside `d(-1,1)`
coefficients, so this is safe), rewrites `(`→`('`, `)`→`')`, `^`→`**`, and maps each
term through `match` in a `Pool(CORE)`. Per term (`_match_impl`, 472-576):

1. `eval` with helper functions in scope: `d('n','m')`→`Fraction`, `phi('1')`→symbol
   `phi_1`, etc.; fugacities `t,s,r,y,X1,g1,...` as sympy symbols.
2. Decode exponents: substitute $r\to s^{1/5000}$, $s\to t^{1/5000}$,
   $t\to t^{1/500}$, then round the resulting $t$-exponent to 3 decimals
   (ROUND_HALF_UP) — physical index powers are 0.001-granular floats.
3. Split the term into character part (symbols containing `_`, i.e. `phi_1`) and
   everything else. **The `1.0*` at line 482 is load-bearing**: it forces a Float
   coefficient so that `char/(char.subs(sym,1))` yields `1.0*phi_1**k` (a `Mul`)
   rather than a bare `Symbol`/`Pow`, which is what the `.args[-1].args` extraction
   at 503-504 relies on. With an exact integer coefficient the same code would raise
   IndexError (exponent 1) or return wrong exponents.
4. Build `rep_structure[name]` = Adams multiplicity vector: entry $k{-}1$ =
   multiplicity of `name_k` = $m_k$, zero-padded to total degree $\sum_k k\,m_k$
   (505-509). Position is absolute, so symbol-iteration order does not matter.
5. Singlet projection:
   - **One species with characters** (512-525): look up the decomposition in the
     precomputed table `arxiv/<GROUP><RANK>/<name>/<name><len>.txt`; each line is a
     Python dict literal `{'[m1,m2,...]': '<LiE poly>'}` found by substring search
     (`picklines`). The singlet multiplicity is read as the coefficient of the
     *first* term if its weight is the zero vector (`decomp[:find("X")]`) —
     correct iff LiE lists the zero weight first (LiE sorts weights ascending, so
     the singlet, when present, is first; confirmed on live LiE output).
   - **≥2 species** (528-572): chain LiE `tensor(products, decomp, C2)` calls via
     `_run_lie` (new session, killable, 180 s timeout), memoized in the MySQL
     `LieCache` table keyed by sha256(GROUP_RANK|products|decomp). LiE stdout is
     parsed by slicing off a fixed 53-character banner (`[53:]`) — valid for the
     `maxnodes 9999999` preamble on this machine (verified live). [Correction,
     step 4: the initial suspicion that the `maxobjects` retry path at 550-557
     adds a second banner line was wrong — `maxobjects` prints no banner, so the
     retry parse is clean; see notes/04-defect-audit.md.] Singlet extraction as
     above.
   - **No characters**: multiplicity 1 (gauge-singlet term).
6. Return (singlet multiplicity) × (non-character part). Sum over terms = the
   gauge-invariant index series in $t^{p}$ (float powers), $y$, matter fugacities
   `X1, q1, ...`, and $U(1)$ fugacities `g1, ...`.

## Stage 4 — `Index`/`decouple` (582-900): Mathematica post-processing

Both write the `match` results to `~/frm/express{pid}.txt` (string surgery:
`e`→`*10^` for float exponents, `**`→`^`, brackets→braces) and run a generated
wolframscript program on it; output is an association exported as a Python literal
and parsed with `ast.literal_eval`. Because `Index` strips *all* spaces before
parsing (line 892), multi-word keys collapse: `"full index"`→`fullindex`,
`"non-manifest symmetry"`→`non-manifestsymmetry` — downstream consumers use the
collapsed names.

Common core (both code generators): `reduced` = $(1-t^3y)(1-t^3/y)(\sum{\rm terms}-1)$
= reduced index; truncate to `Exponent[#,t] < t_order`; round coefficients;
`extractScalar[poly,p]` (620, 705) strips complete $SU(2)_y$ characters
$\sum_{j=-p,-p+2}^{p}y^j$ from the top $y$-power down, leaving the $y$-singlet part
(`indexscalar`); the remainder (`indexspinor`, `Index` only) holds the $y$-charged
states.

- `decouple` (582-665, called by `charges2` at `t_order=3` before the main run):
  extracts only free-field candidates — scalar terms at $t$-exponent $\le 2$
  (i.e. $R\le 2/3$, the unitarity bound) with positive coefficient after the F-term
  substitution `wcond2` — plus a consistency verdict. A hit makes `charges2` add a
  flip field `X` for the decoupled operator and recurse (1233-1236).
- `Index` (667-830): consistency check (three conditions on `indexscalar` /
  `indexspinor`, 719-732 — audited in step 2), then operator extraction with
  thresholds: decoupled $t\le2$ ($R\le\frac23$), `fliped` $t<4$ ($\Delta<2$),
  `relevant` $t<6$ ($\Delta<3$), `marginal` $t=6$, `dim3` = net $t^6$ coefficient
  of the unrefined index, and a `non-manifest symmetry` flag ($t^6$ current count
  exceeding the manifest $U(1)^{\#g}$) — audited in step 3. The F-term substitution
  `wcond2` (637-647, 742-752) replaces negative powers of a matter fugacity $f$
  (fermionic $\bar\psi_f$ letters) by superpotential-partner fugacities
  $(W_{\rm match}/f)^{-1}$, implementing the $\bar\psi_f \sim \partial W/\partial f$
  equation of motion in the counting.

## Verification — toy traces (`calc/01_toy_trace.py`, 11/11 checks pass)

Toy theory: one gauge-singlet chiral `X1` (+ the always-present $C_2$ vector
multiplet, projected out via a minimal structural character table
`{'[1]': '1X[2,0]'}`).

| toy | input | decoded index (Stage 3) | analytic PE | post-processing (Stage 4) |
|---|---|---|---|---|
| 1 | $r=\frac23$, $t_{\rm ord}=3$ | $1+X_1t^{2.0}$ | match | `decouple`: decoupled `[X1]`, consistent |
| 2 | $r=0.8$, $t_{\rm ord}=3$ | $1+X_1t^{2.4}$ | match | `Index`: relevant `[X1]`, fliped `[X1]`, consistent |
| 3 | $r=0.8$, $t_{\rm ord}=5$ | $1+X_1t^{2.4}-X_1^{-1}t^{3.6}+X_1^2t^{4.8}$ | match | `Index`: inconsistent |

Toy 3's verdict is physically right: a $W=0$ chiral with $r\neq\frac23$ is not an
SCFT; the negative scalar term $-X_1^{-1}t^{3.6}$ ($\bar\psi_X$) below $t^6$ trips
the unitarity condition. Toy 1 exercises the decoupling branch exactly at the
unitarity bound. The $r=0.8$ encoding exercises only exact base-5000 digits
($d_1=d_2=0$); rounding asymmetry remains untested (step 4). The multi-species LiE
branch and the MySQL cache are not exercised (need real character tables — step 5).

Environment (this machine): FORM 4.3 (Jan 15 2023, 64-bit), WolframScript 1.8.0,
LiE at `/opt/local/bin/lie` (banner-slice `[53:]` verified for the `maxnodes`
preamble), MySQL client present, `pymysql` **not installed** in the anaconda python
(stubbed in calc; production must run in an env that has it).

## Interpretation

The pipeline is now fully mapped and behaves as designed on gauge-singlet toys at
every stage, including both post-processing branches. Items promoted to later steps
(status after step 4 in brackets): (i) the `maxobjects` retry LiE-parse suspicion
[cleared]; (ii) the `1.0*` Float trick and `.args[-1]` extraction deserve a robust
rewrite (step 7); (iii) encoding rounding asymmetry [cleared — positional
expansion]; (iv) singlet-first ordering assumption on table lines is confirmed for
live LiE but must be checked against the stored tables (step 5); (v) consistency
and extraction rules match the expected physics on toys — the paper-level audit is
steps 2-3.
