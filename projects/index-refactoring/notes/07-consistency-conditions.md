# 07 — Independent derivation of the index consistency conditions

*Date: 2026-08-17 · wiki pages used: [[hep-th-0209056]], [[4d-superconformal-multiplets]], [[multiplet-recombination]], [[superconformal-index]], [[1708.08307]] · references: calc/07_multiplet_index.py, calc/07_free_theory_check.py, calc/07_pipeline_free_chiral.py, calc/07_true_entries_check.py*

## Goal

Derive the consistency conditions C1–C4 on the reduced superconformal index from
4d $\mathcal N=1$ multiplet representation theory, trusting neither the
statement in 2408.02953 nor Evtikhiev 1708.08307 (user decision 2026-08-12):
enumerate every short multiplet's contribution to
$\mathcal I_{\rm red}=(1-t^3y)(1-t^3/y)(\mathcal I-1)$ — which $(E,j)$ term,
which sign — with every ingredient machine-verified, then compare against both
papers and record any typo. Verify criterion: derivation reproduces C1/C2 as
implemented, fixes the exact form of C3, every multiplet contribution checked
against an explicit computation in calc/.

## Conventions

$\mathcal I(t,y)=\mathrm{Tr}(-1)^F t^{3(R+2j_1)}y^{2j_2}$ with $j_1=\bar\jmath$
the **dotted** spin (the $SU(2)$ under which $\bar Q$ and the surviving
derivatives $\partial_{\dot+\pm}$ transform) and $j_2=j$ the **undotted** spin
(the $\chi_j(y)$ character). Identification fixed by the letters of
PROJECT.md: $\bar\psi_{\dot+}\to -t^{3(2-r)}$ requires $j_1$ dotted.
$\delta \equiv \Delta-2\bar\jmath_3-\tfrac32 R \ge 0$ on all states; the index
counts $\delta=0$ cohomology. $R$ is normalized so a chiral primary has
$\Delta=\tfrac32 R$, hence $R(Q)=-1$, $R(\bar Q)=+1$. A $\delta=0$ conformal
member $(\Delta,j,\bar\jmath,R)$ contributes
$(-1)^F t^{3(R+2\bar\jmath)}\chi_j(y)$ to $\mathcal I_{\rm red}$ (only its top
$\bar m=\bar\jmath$ component has $\delta=0$; the two $\partial_{\dot+\pm}$
towers are stripped by the prefactors).

## Derivation

### 1. Algebra input (machine-fixed, not quoted)

The only imported relations are Dolan-Osborn's $su(2,2|\mathcal N)$
(anti)commutators (hep-th/0209056 §3) reduced to $\mathcal N=1$. The one
datum not printed there for $\mathcal N=1$ — the $U(1)_R$ coefficient in
$\{Q,S\}$ — is forced by the super-Jacobi identity $(Q,\bar S,\bar Q)$:
with $\{Q_\alpha,S^\beta\}=4(M_\alpha{}^\beta-\tfrac12 i\delta_\alpha^\beta D)
-4\delta_\alpha^\beta\rho$ one finds $[\rho,Q_\alpha]=+\tfrac34 Q_\alpha$,
i.e. $\rho=-\tfrac34\hat R$ in the physical normalization. In the compact
(S³×R) picture the raising supercharges are $Q^+_\alpha$ (undotted, $R=-1$)
and $\bar S^+_{\dot\alpha}$ (dotted, $R=+1$), with
$$\{\bar S^{-\dot\alpha},\bar S^+_{\dot\beta}\}
 =(2H-3\hat R)\,\delta^{\dot\alpha}_{\dot\beta}-4\bar M^{\dot\alpha}{}_{\dot\beta}\,,
 \qquad
 \{Q^{-\alpha},Q^+_\beta\}=(2H+3\hat R)\,\delta^\alpha_\beta+4M_\beta{}^\alpha\,.$$
Closure of the compact algebra is checked symbolically
(calc/07_multiplet_index.py, A0).

### 2. Unitarity bounds and shortening types (Gram matrices)

Level-1 Gram operator on $\bar S^+_{\dot\alpha}|\Delta,j,\bar\jmath,R\rangle$
is $(2\Delta-3R)\mathbb 1-4T$ with $T=-2\,\vec\jmath\cdot\vec J$ on
$\tfrac12\otimes\bar\jmath$; eigenvalues (verified for
$\bar\jmath=0,\tfrac12,1,\tfrac32$):
$$2\Delta-3R+4\bar\jmath \ \ (\bar\jmath+\tfrac12\ \text{branch})\,,\qquad
  2\Delta-3R-4\bar\jmath-4 \ \ (\bar\jmath-\tfrac12\ \text{branch})\,.$$
Level-2 ($\bar\jmath=0$, normal-ordering engine):
$\|\bar S^+_{\dot+}\bar S^+_{\dot-}|\psi\rangle\|^2\propto(2\Delta-3R)(2\Delta-3R-4)$.
Hence on the barred side exactly four structures (the $\bar Q$-side exhausts
at level 2 — only two supercharges):

| type | condition | $\Delta$ |
|---|---|---|
| $\bar L$ | long | $\Delta>\tfrac32R+2\bar\jmath+2$ |
| $\bar A_1$ ($\bar\jmath\ge\tfrac12$) | level-1 lower-branch null | $\tfrac32R+2\bar\jmath+2$ |
| $\bar A_2$ ($\bar\jmath=0$) | level-2 null | $\tfrac32R+2$ |
| $\bar B_1$ ($\bar\jmath=0$, chiral) | level-1 null (isolated; gap of 2) | $\tfrac32R$ |

Mirror (unbarred) side: replace $R\to-R$, $j\leftrightarrow\bar\jmath$:
continuum bound $\Delta\ge 2+2j-\tfrac32R$ (equality $=A_1/A_2$), isolated
antichiral point $\Delta=-\tfrac32R$ at $j=0$ ($=B_1$).

### 3. Contribution of every multiplet (member enumeration)

$\delta$-shifts of members: each $Q^+$ adds $+2$; $\bar S^+$ upper branch
$-2$, lower branch $0$; $\bar S^+\bar S^+$ net $-2$. Since unitarity puts the
primary at $\delta_0\ge2$ unless $\bar B_1$ ($\delta_0=0$), the $\delta=0$
members are reachable only at $\delta_0\in\{0,2\}$, and no $Q^+$-descendant
ever contributes. Verma modules contribute zero identically (at
$\delta_0=2$ the two candidates, $\bar S^+$-upper and $\bar S^+\bar S^+$,
cancel — verified by enumeration), so the short contributions follow from the
null-subtraction chain
$I(\bar A_1[\bar\jmath])=-I(\bar A_{1/2}[\bar\jmath-\tfrac12,R+1])$,
$I(\bar A_2)=-I(\bar B_1[R+2])$, with $\bar B_1$ computed directly (only the
primary has $\delta=0$).

**Dependence on the unbarred (left) type.** The left type $X$ enters only
through the left-null module, and the distinguishing identity is
$\bar Q_{\dot\alpha}\,(Q|\psi\rangle)=2P_{\dot\alpha}|\psi\rangle-Q(\bar
Q_{\dot\alpha}|\psi\rangle)$ acting on the left-null vector
$\chi=(Q\psi)_{j-1/2}$:

- $X\bar B_1$ **left-saturated** ($X=A_1$, $3R=2+2j$, a free field): the
  primary is chiral, $\bar Q\psi=0$, so $\bar Q_{\dot+}\chi=2(P_{\dot+}
  \psi)_{j-1/2}$ — a $\delta=0$ state: the EOM removes part of the primary's
  own $\delta=0$ derivative tower, and the naive stripped-tower answer
  overcounts. Corrected entry (the residual; $\chi_{-1/2}\equiv0$ makes the
  $j=0$ free scalar residual-free):
  $$A_1\bar B_1[j,0,R]:\quad(-1)^{2j}\big(t^{3R}\chi_j-t^{3R+3}\chi_{j-\frac12}\big)\,.$$
  Verified independently by on-shell letter enumeration: level-$n$ letters
  $\chi_{n/2}\chi_j-\chi_{(n-1)/2}\chi_{j-1/2}=\chi_{n/2+j}$ (the massless
  tower), whose reduced sum equals the two-term entry exactly
  (calc/07_multiplet_index.py, D).
- $X\bar A_2$, $X\bar A_1$ (incl. left-saturated current multiplets): here
  $\bar Q\psi\neq0$ and $\bar Q^2\chi$ is the $\epsilon$-contraction of
  $P(\bar Q\psi)$ plus $Q\bar Q^2\psi$-terms, all of which have $\delta=2$
  (the $\delta=0$ tower of the carrier is its symmetric
  $\partial_{\dot+}$-dressing, which the $\epsilon$-contraction misses) — no
  correction. Corroborated by the free-Maxwell $t^9$ closure (single-term
  current multiplets) and the free-hyper $+t^7\chi_{1/2}$ coefficient $=1$.

Result table ($X$ = any left type allowed by unitarity; contribution
independent of $X$ except the left-saturated $\bar B_1$ row):

| multiplet | $\mathcal I_{\rm red}$ contribution | unitarity range of $E$ |
|---|---|---|
| $X\bar B_1[j,0,R]$ | $(-1)^{2j}\,t^{3R}\chi_j(y)$ | $E=3R\ge 2+2j$; equality $\iff$ free field ($X=A_1$), which adds the EOM residual $(-1)^{2j+1}t^{3R+3}\chi_{j-1/2}$ (absent for $j=0$) |
| $X\bar A_2[j,0,R]$ | $(-1)^{2j+1}\,t^{6+3R}\chi_j(y)$ | $E\ge 6+2j$ (left bound $3R\ge2j$; equality $\iff$ conserved-current multiplet $A_1\bar A_2$); antichiral branch: $j=0$, $R=-\tfrac23$, $E=4$ = free antichiral scalar |
| $X\bar A_1[j,\bar\jmath,R]$ | $(-1)^{2j+2\bar\jmath+1}\,t^{6+3R+6\bar\jmath}\chi_j(y)$ | $E\ge 6+2j+4\bar\jmath$ (left bound $3R\ge 2j-2\bar\jmath$; equality $\iff$ conserved-current $A_1\bar A_1$, e.g. stress tensor $j=\bar\jmath=\tfrac12$: $-t^9\chi_{1/2}$); antichiral branch: $j=0$, $E=4+4\bar\jmath$ (free, e.g. $[\bar\lambda]$: $+t^6$) |
| $X\bar L$ | $0$ | — |

### 4. The derived conditions

Scanning the table per $\chi_j$ sector (calc/07_multiplet_index.py, C), with
"chiral sign" $=(-1)^{2j}$ and "wrong sign" $=(-1)^{2j+1}$:

- **C1** (derived): no unitary multiplet contributes at $E<2+2j$. Any such
  term $\Rightarrow$ non-unitary. Both signs forbidden.
- **C1′** (boundary, sharper than the papers/code): content at $E=2+2j$
  exactly is exclusively free-field ($\bar B_1$ at left saturation). $j=0$:
  free scalar — the decoupling branch. $j\ge\tfrac12$: a net chiral-sign
  coefficient at $E=2+2j$ signals a **free spinning sector** (e.g. the free
  vector's gaugino $-t^3\chi_{1/2}$) — checked by neither the code nor the
  papers' stated conditions.
- **C2** (derived): wrong-sign terms with $2+2j\le E<6+2j$ have exactly one
  unitary source: the free antichiral scalar ($j=0$, $E=4$), whose CPT
  partner $+t^2$ fires the decoupling branch first. In a candidate with no
  free fields, any wrong-sign term in the window $\Rightarrow$ non-unitary.
  The closed lower edge is correct: at $E=2+2j$ the wrong sign has no source
  at all.
- **C3** (derived, exact form): at $E=6+2j$ the wrong-sign source is
  exactly the conserved-current multiplet $A_1\bar A_2[j,0,\tfrac{2j}3]$
  (Evtikhiev's $\hat{\mathcal H}_{(0,j)}$; primary $(\Delta,j,\bar\jmath,R)
  =(2+j,\,j,\,0,\,\tfrac{2j}3)$, whose $\bar S^+$-descendant is a conserved
  spin-$(j,\tfrac12)$ current); the chiral $\bar B_1[j,0,\tfrac{6+2j}3]$
  contributes with the opposite sign. Hence net coefficient $c>0$ of
  $(-1)^{2j+1}t^{6+2j}\chi_j$ $\Rightarrow$ at least $c$ such multiplets:
  $j=0$: flavor currents ($\alpha=\#$marginal$-\#$currents at $t^6$);
  $j=\tfrac12$: extra supercurrents $\Rightarrow$ $\mathcal N\ge 1+c$ or free
  (the $t^7(y+1/y)$ signature); $j\ge1$: conserved higher-spin current
  $\Rightarrow$ free sector, **given the input** that higher-spin currents
  occur only in free theories (Maldacena-Zhiboedov 1112.1016; 4d versions
  Alba-Diab 1307.8092, Stanev — not in LLMwiki, used as a sanctioned input
  per the step plan). The converse is false: the negative partners — the
  chiral $\bar B_1[j,0,\tfrac{6+2j}3]$ and the EOM residual of a free field
  of spin $j+\tfrac12$ (table above) — can hide the multiplet, and a free
  sector need not populate this term.
- **C4** (derived): every contribution has $E\ge2>0$, so any unitary
  $\mathcal N=1$ SCFT has $\mathcal I=1+O(t^2)\neq0$; a vanishing computed
  index is incompatible with a unitary supersymmetric fixed point.
- **No condition from currents with $\bar\jmath\ge\tfrac12$** (asked
  2026-08-18: do the $j\ge1$, $\bar\jmath\ge1$ higher-spin currents give a
  usable condition — answer: no). The current multiplets
  $A_1\bar A_1[j,\bar\jmath,\tfrac{2(j-\bar\jmath)}3]$ — the stress tensor
  $(\tfrac12,\tfrac12)$ and every higher-spin current with
  $\bar\jmath\ge\tfrac12$ — sit at $E=6+2j+4\bar\jmath$, strictly above the
  window edge, where unsaturated multiplets share the same
  $(E,\chi_j,\text{sign})$: integer $\bar\jmath$ (wrong sign) is degenerate
  with unsaturated $X\bar A_2[j,0,\tfrac{2j+4\bar\jmath}3]$; half-odd
  $\bar\jmath$ (chiral sign) with ordinary chirals
  $X\bar B_1[j,0,\tfrac{6+2j+4\bar\jmath}3]$. So their presence is neither
  detectable nor boundable — the window-edge uniqueness that powers C3
  exists only at $\bar\jmath=0$, which is why the sufficient-condition list
  ends with the $\hat{\mathcal H}_{(0,j)}$ family. Concrete faces: the
  stress tensor $-t^9\chi_{1/2}$ is degenerate with spin-$\tfrac12$ chirals
  of $R=3$; the mirror extra supercurrent $\hat{\mathcal H}_{(\frac12,0)}$
  ($+t^8\chi_0$) hides behind $R=\tfrac83$ chiral scalars (hence only one
  sufficient enhancement condition in this index); the free chiral's own
  higher-spin current multiplet $A_1\bar A_1[1,\tfrac12,\tfrac13]$ appears
  at $+t^{10}\chi_1$ with the harmless chiral sign.
  (calc/07_multiplet_index.py, E)

## Verification

- calc/07_multiplet_index.py — **22/22**: Jacobi closure; level-1/2 Gram
  eigenvalues and factorization; Verma index $\equiv0$; contribution table by
  three independent routes (direct $\bar B_1$, null-subtraction chain, member
  enumeration at threshold); recombination identities; mechanical region scan
  reproducing C1/C1′/C2/C3/C4; part D: the free-field EOM residual verified
  by on-shell letter enumeration ($\chi_{n/2}\chi_j-\chi_{(n-1)/2}
  \chi_{j-1/2}=\chi_{n/2+j}$, reduced sum $=t^{3R}\chi_j-t^{3R+3}
  \chi_{j-1/2}$ exactly, for $j=0,\tfrac12,1,\tfrac32$); part E: slot
  contamination for every current multiplet with $\bar\jmath\ge\tfrac12$,
  window-edge uniqueness only at $\bar\jmath=0$.
- calc/07_free_theory_check.py — **19/19**, exact sympy PE to $t^{10}$:
  - free chiral ($r=\tfrac23$): $\mathcal I_{\rm red}=t^2-t^9\chi_{1/2}+t^{10}\chi_1+\dots$
    — free-scalar boundary, stress-tensor multiplet $-t^9\chi_{1/2}$, first
    higher-spin current multiplet $A_1\bar A_1[1,\tfrac12,\tfrac13]$ at
    $+t^{10}\chi_1$; region-clean; sharp zeros at $t^3,t^4,t^5,t^6,t^7$ and
    $t^8\chi_0$ exactly as the table predicts (e.g. $\varphi^2$ against
    $\bar\psi$ at $t^4$, marginal $\varphi^3$ against the $U(1)$ current at
    $t^6$, $\varphi^4$ against $\bar A_2[\varphi^2\bar\varphi]$ at $t^8$).
    **No C3 term** — no operator with $(j,0)$, $\Delta=2+j$, $R=\tfrac{2j}3$
    exists here, confirming the converse of C3 is false.
  - free $U(1)$ vector: $\mathcal I_{\rm red}=-t^3\chi_{1/2}+3t^6
    +t^9(\chi_{3/2}-\chi_{1/2})+\dots$ — the C1′ spinning boundary
    ($-t^3\chi_{1/2}$, gaugino); the **C3 signal realized**:
    $+t^9\chi_{3/2}=(-1)^{2j+1}t^{6+2j}\chi_j$ at $j=\tfrac32$, coefficient
    $+1$, from $A_1\bar A_2[\tfrac32,0,1]$ with primary
    $\lambda_{(\alpha}F_{\beta\gamma)}$ ($\Delta=\tfrac72$, $R=1$,
    left-saturated $3R=2j$); and the $t^6$ coefficient **closes at 3** only
    with the corrected two-term free-fermion entry:
    $\lambda\lambda$ chiral ($+1$) $+$ $[\bar\lambda]$ ($+1$) $+$ the
    $[\lambda]$ EOM residual ($+t^{3R+3}\chi_0$, $+1$); the $t^9$
    coefficients close with single-term current multiplets (no further
    residuals).
  - free hypermultiplet (2 chirals): $+t^7\chi_{1/2}$ with coefficient $1$ —
    the extra-supercurrent multiplet $A_1\bar A_2[\tfrac12,0,\tfrac13]$
    ($\mathcal N=2$ enhancement signature), the $j=\tfrac12$ member of the
    same family.
- calc/07_pipeline_free_chiral.py — **3/3**: the production FORM + match
  front end (vector term deleted from the generated FORM source; t_order 9)
  equals the exact PE term-by-term in $(t,y,X_1)$ through $t^9$, and after
  reduction gives exactly $t^2-t^9\chi_{1/2}$ — the pipeline front end
  reproduces the derived multiplet structure including the stress-tensor
  term at the truncation edge. (The free-vector C3 realization cannot be
  pushed through the pipeline: its vector sector is tied to a non-abelian
  gauge group and character tables; sympy-exact only.)
- calc/07_true_entries_check.py — **8/8** (4 region + 4 provenance,
  the latter reproducing observations 3-4 below from
  `work05/replay_outcomes.jsonl`): all 82 true entries sit strictly
  inside the derived allowed region (no C1, no boundary, no C2, no C3 hits;
  truncation covers the C2 windows for $j\le1$ and C3 at $t^6,t^7,t^8$;
  $t^9$/$j=\tfrac32$ is at the truncation edge and not visible). No
  $t^7\chi_{1/2}$ enhancement signatures in the true set; 80/82 have
  negative $t^6$ (currents outnumber marginals).

## Comparison against the papers (cross-check c)

After convention translation (Evtikhiev $t=\mathfrak t^3$, $x=y$, his
$\tilde R=E/3-2$, his second spin slot = our $j$):

- **2408.02953 §2.3**: C1, C2 (window $2+2j\le E<6+2j$, sign
  $(-1)^{2j+1}$), C3 ($j\ge1$, positive coefficient of
  $(-1)^{2j+1}t^{6+2j}\chi_j$ $\Rightarrow$ free, "another multiplet
  contributes negatively", converse false), C4 — **all agree with the
  derivation; no typo found.** The "spin-$(j+1)$ current" phrasing matches
  the top conserved current of $A_1\bar A_2[j,0,\tfrac{2j}3]$.
- **1708.08307** sanity checks 1(a),(b) $=$ C1, C2; sanity check 2 $=$ C3
  with the class $[\tfrac{2j}3,j]_+$ containing only
  $\hat{\mathcal H}_{(0,j)}$, and $[\tfrac{2j}3,j]_-$ (chirals) nonempty;
  the $t^{7/3}(x+\tfrac1x)$ sufficient condition $=$ our $j=\tfrac12$
  member; his class-contribution formula and his appendix reference list of
  $\mathcal N=1$ contributions (\S{n1index}) match the corrected table
  entry-by-entry — including the two-term free-field entries
  ($\hat{\mathcal S}_{(0,\frac12)}\to-t(x+\tfrac1x)+t^2$ $=$ our
  $-t^3\chi_{1/2}+t^6$) — **with one typo found**: his general formula
  $\hat{\mathcal H}_{(j,\bar\jmath)}\to-(-1)^{2j+2\bar\jmath}
  t^{2+(\bar\jmath+2j)/3}\chi_{\bar\jmath}(x)$ contradicts his own special
  cases ($t^{7/3},t^{8/3},t^3$) and the derivation; the correct exponent is
  $2+(2\bar\jmath+4j)/3$ (in our units $E=6+2j+4\bar\jmath$ with his
  $(j,\bar\jmath)$ mirrored). **Main-text condition statements: typo-free.**

The user's distrust of both statements is discharged by proof rather than
assumption: the independently derived conditions coincide with both papers'
main-text statements; the one typo found sits in 1708.08307's appendix
reference formula for $\hat{\mathcal H}_{(j,\bar\jmath)}$.

## New observations (for step 8 and the final report)

1. **C1′ spinning boundary is unchecked (extends F1).** A net chiral-sign
   term at $E=2+2j$ with $j\ge\tfrac12$ (free fermion/vector content, e.g.
   $-t^3\chi_{1/2}$) passes the current code silently; only the $j=0$
   decoupling branch exists. Step 8: check boundary content for all $j$.
2. **F1 implementation spec fixed by the proven C3 form**: flag net
   coefficient $c>0$ of $(-1)^{2j+1}t^{6+2j}\chi_j$; $j\ge1$ $\Rightarrow$
   free sector; $j=\tfrac12$ $\Rightarrow$ $\mathcal N\ge2$ candidate (not an
   inconsistency); at t_order 9 the scan covers $j=1$ ($t^8$) fully, $j=\tfrac32$
   ($t^9$) sits at the truncation edge — document or raise the order.
3. **Baseline provenance**: the 19 curated-out lines of `SU3s1S1nf2.txt`
   carry stored verdict `consistent` although 16 of their own stored indices
   contain net C2 violations — the 101-line file predates (or bypassed) the
   current C1/C2 check; the fresh replay's 17 rejections are the corrected
   verdicts. Refines the F5 story: "later found inconsistent" = after the
   check was fixed/enabled.
4. **Per-flavor refinement is strictly stronger than the net check**,
   demonstrated on real data: line 90 (`['M1*q2*qb1','M2*S1*Sb1','M1*M2']`)
   is rejected by the code's per-$U(1)$-flavor C2 check while its
   fugacity$\to$1 net index is violation-free.
5. **$t^6$ caveat in free-sector-bearing theories**: two free-sector
   mechanisms shift the marginal$-$currents count — antichiral-branch free
   multiplets (e.g. $[\bar\lambda]$: $+t^6$) and the EOM residual of free
   spinning chirals (e.g. $[\lambda]$: $+t^6$ second term); the
   $\alpha$-interpretation of the $t^6$ coefficient assumes no free sector.
6. **Corrected table entry (user finding, 2026-08-18)**: the left type $X$
   is NOT always irrelevant — the left-saturated $A_1\bar B_1$ (free
   spinning chiral) carries the extra EOM residual
   $(-1)^{2j+1}t^{3R+3}\chi_{j-1/2}$; first flagged by the user, confirmed
   by the free-vector $t^6$ closure, the on-shell letter enumeration, and
   Evtikhiev's own reference list. This also exposed the appendix typo in
   1708.08307 recorded above.

## Interpretation

C1 and C2 — the two conditions that decide landscape verdicts — are now
*proven* correct as implemented (per-flavor-refined, procedure-ordered after
free-field removal), independently of both papers. C3's exact form, its
carrier multiplet, its negative partners, and its $j$-dependence
(currents/supercurrents/higher-spin) are established and realized explicitly
in free theories; C4 follows from $E\ge2$. The plan's cross-check (a)
expectation ("free chiral and free vector must realize the C3 signal") was
half wrong — representation theory forbids the free chiral from populating
it; the free vector realizes it at $j=\tfrac32$ — and the checks were
corrected accordingly. The contribution table is independent of the
unbarred type with exactly one exception, the left-saturated
$A_1\bar B_1$ free field, whose EOM residual
$(-1)^{2j+1}t^{3R+3}\chi_{j-1/2}$ was missed in the first version of this
note and supplied by the user; the derived conditions C1–C4 are unchanged
by it, and the residual joined the negative C3 contributors. Everything
step 8 needs (F1/F2 specs, the C1′ gap, truncation coverage) is pinned
down.
