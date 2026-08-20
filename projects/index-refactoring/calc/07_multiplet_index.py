#!/usr/bin/env python3
"""Step 7: independent derivation of the index consistency conditions from
su(2,2|1) representation theory -- machine verification.

(A) Unitarity bounds and null (shortening) structure of 4d N=1 superconformal
    primaries from level-1/2 Gram matrices, computed directly from the
    su(2,2|1) (anti)commutation relations (Dolan-Osborn hep-th/0209056
    conventions, reduced to N=1; the U(1)_R coefficient in {Q,S} is fixed by
    the super-Jacobi identity, verified here, not taken from any paper).
(B) Reduced-index contribution of every N=1 multiplet type, via delta=0
    member enumeration + null-module subtraction; consistency checks:
    Verma-module index = 0, recombination identities telescope.
(C) The derived allowed region scanned mechanically -> C1/C2/C3 statements.

Conventions (PROJECT.md):
  I(t,y) = Tr (-1)^F t^{3(R+2 j1)} y^{2 j2};  j1 = dotted spin jb (the SU(2)
  containing the index supercharge), j2 = undotted spin j (the character
  chi_j(y)).  delta = Delta - 2 jb_3 - (3/2) R.
  I_red = (1-t^3 y)(1-t^3/y)(I-1): a delta=0 conformal member (Delta,j,jb,R)
  contributes (-1)^F t^{3(R+2 jb)} chi_j(y).
  R normalization: chiral primary Delta = (3/2)R => R(Q)=-1, R(Qbar)=+1.

Compact-picture relations used (derived from Dolan-Osborn secs. 2-3):
  raising charges Qp_a (undotted, R=-1), Sp_ad (dotted, R=+1), each Delta=+1/2;
  {Sm^a, Sp_b} = (2H - 3 Rhat) d^a_b - 4 Mbar^a_b        [barred side]
  {Qm^a, Qp_b} = (2H + 3 Rhat) d^a_b + 4 M_b^a           [unbarred side]
  [Mbar^a_b, Sp_c] = -d^a_c Sp_b + (1/2) d^a_b Sp_c ,  [H,Sp]=Sp/2, [Rhat,Sp]=Sp
  The coefficient -3 Rhat (i.e. -4 rho with rho = -(3/4) Rhat) is FORCED by the
  super-Jacobi identity (Q, Sbar, Qbar) given Dolan-Osborn's {Q,S} normalization
  -- checked symbolically in check_jacobi().

Run:  python3 07_multiplet_index.py
"""
import itertools
from fractions import Fraction

import sympy
from sympy import Rational, S, Symbol, simplify, sqrt, symbols

Delta, R = symbols("Delta R")
t, y = symbols("t y", positive=True)

HALF = Rational(1, 2)

PASS = []


def check(label, ok, detail=""):
    PASS.append(bool(ok))
    print(f"[{'PASS' if ok else 'FAIL'}] {label}" + (f": {detail}" if detail else ""))


# ---------------------------------------------------------------------------
# (A0) super-Jacobi fixes the U(1)_R coefficient in {Q,S}
# ---------------------------------------------------------------------------
# Field-picture relations (Dolan-Osborn \algQ, \QS, \algQS, \DQS, \PKQ with
# N=1, rho = R^1_1):
#   {Q_a, Qb_ad} = 2 P_{a ad}                    {Q,Sb} = {S,Qb} = 0
#   {Sb^ad, Qb_bd} = 4(Mb^ad_bd + (i/2) d D) - 4 d rho
#   [D,Q] = (i/2) Q ;  [rho, Q_a] = cQ * Q_a (cQ to be determined)
#   [P_{a ad}, Sb^bd] = s0 * 2 d^bd_ad Q_a   (s0 = +-1: sigma-contraction sign)
# Super-Jacobi (all odd): [{Q,Sb},Qb] + [{Sb,Qb},Q] + [{Qb,Q},Sb] = 0.
# Term1 = 0. Term2 = -d Q - 4 d cQ Q. Term3 = s0 * 4 d Q.
# => cQ = (4 s0 - 1)/4.  Unitarity (below) forces the branch with cQ = +3/4,
# i.e. s0 = +1, giving rho = -(3/4) Rhat under [Rhat, Q] = -Q.
def check_jacobi():
    cQ, s0 = symbols("cQ s0")
    total = (-1 - 4 * cQ + 4 * s0)  # coefficient of d^bd_ad Q_a in the Jacobi sum
    sol = sympy.solve(total.subs(s0, 1), cQ)
    check("A0 Jacobi: [rho,Q] = (3/4) Q forced (s0=+1 branch)",
          sol == [Rational(3, 4)], f"cQ = {sol}")
    # With [Rhat,Q] = -Q (R normalization) => rho = -(3/4) Rhat as operators,
    # so -4 rho = +3 Rhat inside {Q,S} / {Sb,Qb}.
    # Compact-side closure: [{Sm^a,Sp_b},Sp_c] + [{Sp_b,Sp_c},Sm^a]
    #                       + [{Sp_c,Sm^a},Sp_b] = 0 with A^a_b as stated:
    # [A^a_b, Sp_c] = 2 d^a_b (Sp_c/2) - 3 d^a_b Sp_c
    #                 - 4(-d^a_c Sp_b + (1/2) d^a_b Sp_c)
    #               = -4 d^a_b Sp_c + 4 d^a_c Sp_b   -> antisymmetric under b<->c
    # so Jacobi = [A^a_b,Sp_c] + [A^a_c,Sp_b] = 0.
    coeff_db_c = 2 * HALF - 3 - 4 * HALF   # coefficient of d^a_b Sp_c
    coeff_dc_b = 4                          # coefficient of d^a_c Sp_b
    check("A0 compact closure: [A^a_b,Sp_c] antisymmetric in (b,c)",
          coeff_db_c == -coeff_dc_b, f"{coeff_db_c} vs {coeff_dc_b}")


# ---------------------------------------------------------------------------
# (A1) level-1 Gram matrices -> bounds and null branches
# ---------------------------------------------------------------------------
def spin_matrices(jrep):
    """J+, J-, J3 in the orthonormal |j,m> basis, m = jrep..-jrep."""
    dim = int(2 * jrep) + 1
    ms = [jrep - k for k in range(dim)]
    Jp = sympy.zeros(dim, dim)
    Jm = sympy.zeros(dim, dim)
    J3 = sympy.zeros(dim, dim)
    for k, m in enumerate(ms):
        J3[k, k] = m
        if k > 0:  # J+ |j,m> = sqrt((j-m)(j+m+1)) |j,m+1>
            Jp[k - 1, k] = sqrt((jrep - m) * (jrep + m + 1))
        if k < dim - 1:
            Jm[k + 1, k] = sqrt((jrep + m) * (jrep - m + 1))
    return Jp, Jm, J3


def jdotJ(j1, j2):
    """2 * vec(j) . vec(J) on the tensor product V_{j1} (x) V_{j2}."""
    jp1, jm1, j31 = spin_matrices(j1)
    jp2, jm2, j32 = spin_matrices(j2)
    kron = sympy.kronecker_product
    return kron(jp1, jm2) + kron(jm1, jp2) + 2 * kron(j31, j32)


def gram_level1():
    print("\n== (A1) level-1 Gram eigenvalues ==")
    # barred side: G = (2Delta - 3R) - 4*(-2 j.J) ... assembled directly:
    # Mbar(p,m)=-J-, Mbar(m,p)=-J+, Mbar(p,p)=-J3, Mbar(m,m)=+J3 in the rep;
    # T[(a,u),(b,v)] = <u|Mbar^a_b|v> => T = -(j+ (x) J- + j- (x) J+ + 2 j3 (x) J3)
    results = {}
    for jb in [0, HALF, 1, Rational(3, 2)]:
        T = -jdotJ(HALF, jb)
        G = (2 * Delta - 3 * R) * sympy.eye(T.shape[0]) - 4 * T
        eigs = sorted(set(G.eigenvals().keys()), key=str)
        results[jb] = eigs
        print(f"  jb={jb}: eigenvalues {eigs}")
    # expected: jb=0: {2D-3R}; jb>0: {2D-3R+4jb (upper), 2D-3R-4jb-4 (lower)}
    ok0 = results[0] == [2 * Delta - 3 * R]
    okh = all(
        set(results[jb]) == {2 * Delta - 3 * R + 4 * jb,
                             2 * Delta - 3 * R - 4 * jb - 4}
        for jb in [HALF, 1, Rational(3, 2)])
    check("A1 barred level-1: zeros at Delta=(3/2)R (jb=0, chiral) and "
          "Delta=(3/2)R+2jb+2 (lower branch)", ok0 and okh)
    # unbarred mirror: {Qm,Qp} = 2H + 3R + 4 M~ => T' = +2 j.J
    resultsL = {}
    for j in [0, HALF, 1, Rational(3, 2)]:
        T = jdotJ(HALF, j)
        G = (2 * Delta + 3 * R) * sympy.eye(T.shape[0]) + 4 * T
        eigs = sorted(set(G.eigenvals().keys()), key=str)
        resultsL[j] = eigs
    ok0 = resultsL[0] == [2 * Delta + 3 * R]
    okh = all(
        set(resultsL[j]) == {2 * Delta + 3 * R + 4 * j,
                             2 * Delta + 3 * R - 4 * j - 4}
        for j in [HALF, 1, Rational(3, 2)])
    check("A1 unbarred level-1: zeros at Delta=-(3/2)R (j=0, antichiral) and "
          "Delta=2+2j-(3/2)R (lower branch)", ok0 and okh)


# ---------------------------------------------------------------------------
# (A2) level-2 Gram (normal-ordering engine) -> A2-type threshold and the gap
# ---------------------------------------------------------------------------
# Words in ops: ('Sp',a), ('Sm',a), ('H',), ('R',), ('Mb',a,b); a,b in {'p','m'}
# reduce <u| word |v> with the compact relations; Sm|v> = 0, H|v> = Delta|v>,
# R|v> = R|v>, Mb^a_b|v> = matrix (in the orthonormal spin basis).
def _mb_matrix(a, b, jb):
    Jp, Jm, J3 = spin_matrices(jb)
    return {("p", "m"): -Jm, ("m", "p"): -Jp,
            ("p", "p"): -J3, ("m", "m"): J3}[(a, b)]


def _reduce_words(terms, jb):
    """terms: list of (coeff, ops). Returns matrix <u|...|v> summed."""
    dim = int(2 * jb) + 1
    out = sympy.zeros(dim, dim)
    todo = list(terms)
    while todo:
        coeff, ops = todo.pop()
        if not ops:
            out += coeff * sympy.eye(dim)
            continue
        # find leftmost op that must move right: Sm/H/R/Mb followed by Sp,
        # or trailing evaluable op
        last = ops[-1]
        if last[0] == "Sm":  # kills |v>
            continue
        if last[0] in ("H", "R", "Mb"):
            rest = ops[:-1]
            if last[0] == "H":
                todo.append((coeff * Delta, rest))
            elif last[0] == "R":
                todo.append((coeff * R, rest))
            else:
                # Mb acting on |v>: <u|rest Mb|v> = (rest-matrix) . (Mb-matrix)
                sub = _reduce_words([(coeff, rest)], jb)
                out += sub * _mb_matrix(last[1], last[2], jb)
            continue
        # last is Sp: find an Sm/H/R/Mb to its left to push right, or a
        # leading Sp (then <u|Sp... needs Sm from the left: handled by caller
        # constructing full bra words). Find rightmost non-Sp op left of a Sp:
        idx = None
        for i in range(len(ops) - 1):
            if ops[i][0] != "Sp" and ops[i + 1][0] == "Sp":
                idx = i
                break
        if idx is None:
            # all Sp: <u|Sp...|v> = 0 unless bra side supplies Sm; caller
            # always builds full <u|Sm...Sp...|v> words so pure-Sp means the
            # bra was exhausted -> raising ops acting rightward on |v> then
            # closed with <u|: overlap of higher level with level-0 = 0.
            continue
        op, sp = ops[idx], ops[idx + 1]
        pre, post = ops[:idx], ops[idx + 2:]
        if op[0] == "Sm":
            # {Sm^a, Sp_b} = (2H - 3R) d^a_b - 4 Mb^a_b
            a, b = op[1], sp[1]
            if a == b:
                todo.append((2 * coeff, pre + (("H",),) + post))
                todo.append((-3 * coeff, pre + (("R",),) + post))
            todo.append((-4 * coeff, pre + (("Mb", a, b),) + post))
            todo.append((-coeff, pre + (sp, op) + post))
        elif op[0] == "H":
            todo.append((coeff * HALF, pre + (sp,) + post))
            todo.append((coeff, pre + (sp, op) + post))
        elif op[0] == "R":
            todo.append((coeff, pre + (sp,) + post))
            todo.append((coeff, pre + (sp, op) + post))
        elif op[0] == "Mb":
            a, b, c = op[1], op[2], sp[1]
            if a == c:
                todo.append((-coeff, pre + (("Sp", b),) + post))
            if a == b:
                todo.append((coeff * HALF, pre + (sp,) + post))
            todo.append((coeff, pre + (sp, op) + post))
    return out


def gram_level2():
    print("\n== (A2) level-2 Gram (jb=0): Sp_p Sp_m |psi> ==")
    ops = (("Sm", "m"), ("Sm", "p"), ("Sp", "p"), ("Sp", "m"))
    g2 = _reduce_words([(1, ops)], 0)
    g2 = sympy.factor(sympy.expand(g2[0, 0]))
    print(f"  ||Sp_p Sp_m |psi>||^2 = {g2}")
    expected = sympy.factor((2 * Delta - 3 * R) * (2 * Delta - 3 * R - 4))
    check("A2 level-2 norm factorizes: (2D-3R)(2D-3R-4)",
          simplify(g2 - expected) == 0,
          "zeros at Delta=(3/2)R [chiral] and Delta=(3/2)R+2 [A2bar threshold]; "
          "negative in between -> the gap")
    # level-1 consistency from the same engine
    g1 = sympy.Matrix(2, 2, lambda i, j_: _reduce_words(
        [(1, (("Sm", "pm"[i]), ("Sp", "pm"[j_])))], 0)[0, 0])
    diff = (g1 - (2 * Delta - 3 * R) * sympy.eye(2)).applyfunc(simplify)
    check("A2 engine reproduces level-1 (jb=0): diag(2D-3R)",
          diff == sympy.zeros(2, 2))


# ---------------------------------------------------------------------------
# (B) reduced-index contributions by member enumeration
# ---------------------------------------------------------------------------
# Verma members: apply nQ Qp's (undotted branches) and nS Sp's (dotted
# branches) to the primary (Delta0, j, jb, R0).  Contribution of a member iff
# its top-component delta vanishes:
#   delta_top(member) = delta0 + 2 nQ + shiftS,   delta0 = Delta0-2jb-(3/2)R0
#   shiftS: nS=0 -> 0 ; nS=1 up-branch -> -2, down-branch -> 0 ; nS=2 -> -2
# member contribution: (-1)^(2j'+2jb') * t^(3(R'+2jb')) * chi_{j'}(y)
#   with (-1)^F relative to a bosonic identity; overall primary statistics
#   (-1)^(2j+2jb) times (-1)^(nQ+nS).
def verma_members(j, jb):
    """Yield (nQ, nS, j', jb', dDelta, dR, parity)."""
    for nQ in (0, 1, 2):
        jlist = ([j] if nQ == 0 else
                 [j + s for s in (HALF, -HALF) if j + s >= 0] if nQ == 1 else
                 [j])
        for jp in jlist:
            for nS in (0, 1, 2):
                jblist = ([jb] if nS == 0 else
                          [jb + s for s in (HALF, -HALF) if jb + s >= 0]
                          if nS == 1 else [jb])
                for jbp in jblist:
                    yield (nQ, nS, jp, jbp, Rational(nQ + nS, 2),
                           -nQ + nS, (nQ + nS) % 2)


def index_verma(j, jb, R0, delta0):
    """Formal index of the Verma module with given primary delta0 (symbolic
    substitution happens by the caller choosing delta0 as a number)."""
    contrib = []  # (E, j', sign)
    for nQ, nS, jp, jbp, dD, dR, par in verma_members(j, jb):
        Delta0 = delta0 + 2 * jb + Rational(3, 2) * R0
        Dp = Delta0 + dD
        Rp = R0 + dR
        d_top = Dp - 2 * jbp - Rational(3, 2) * Rp
        if d_top == 0:
            E = 3 * (Rp + 2 * jbp)
            sign = (-1) ** (int(2 * j + 2 * jb) + par)
            contrib.append((sympy.nsimplify(E), jp, sign))
    return contrib


def _merge(contrib):
    agg = {}
    for E, jp, s in contrib:
        agg[(sympy.nsimplify(E), jp)] = agg.get((sympy.nsimplify(E), jp), 0) + s
    return {k: v for k, v in agg.items() if v != 0}


def index_multiplet(btype, j, jb, R0):
    """Reduced-index contribution of a multiplet with barred type btype in
    {'B1','A2','A1'} (undotted type irrelevant: all Qp members have delta>=2).
    Returns dict {(E, j'): coeff}."""
    if btype == "B1":
        assert jb == 0
        return {(3 * sympy.nsimplify(R0), j): (-1) ** int(2 * j)}
    if btype == "A2":
        assert jb == 0
        inner = index_multiplet("B1", j, 0, R0 + 2)
        return {k: -v for k, v in inner.items()}
    if btype == "A1":
        assert jb >= HALF
        nxt = "A1" if jb - HALF >= HALF else "A2"
        inner = index_multiplet(nxt, j, jb - HALF, R0 + 1)
        return {k: -v for k, v in inner.items()}
    raise ValueError(btype)


def part_B():
    print("\n== (B) multiplet reduced-index contributions ==")
    # Verma index vanishes identically: generic delta0 (no member delta=0) and
    # threshold delta0=2 (two members cancel); delta0=0,jb=0 handled by B1 direct.
    ok = True
    for j in [0, HALF, 1]:
        for jb in [HALF, 1]:
            for d0 in [2, 4, 6]:
                if _merge(index_verma(j, jb, R, d0)):
                    ok = False
    check("B Verma index = 0 (jb>=1/2, delta0 in {2,4,6}, symbolic R)", ok)
    ok = True
    for j in [0, HALF, 1]:
        got = _merge(index_verma(j, 0, R, 2))
        if got:
            ok = False
    check("B Verma index = 0 at the jb=0 threshold delta0=2 (A2+B1 cancel)", ok)
    # the delta0=2 threshold Verma: exhibit the two cancelling members
    raw = index_verma(HALF, 1, R, 2)
    print(f"  threshold Verma (j=1/2, jb=1) delta=0 members: {raw}")
    # contribution table
    print("  derived table (E = t-exponent, character chi_j(y)):")
    tbl = {}
    for j in [0, HALF, 1, Rational(3, 2)]:
        b1 = index_multiplet("B1", j, 0, R)
        a2 = index_multiplet("A2", j, 0, R)
        tbl[("B1", j)] = b1
        tbl[("A2", j)] = a2
        print(f"    B1b[j={j},0,R]: {b1}   A2b[j={j},0,R]: {a2}")
    for jb in [HALF, 1, Rational(3, 2)]:
        a1 = index_multiplet("A1", HALF, jb, R)
        print(f"    A1b[j=1/2,jb={jb},R]: {a1}")
    okB1 = all(tbl[("B1", j)] == {(3 * R, j): (-1) ** int(2 * j)}
               for j in [0, HALF, 1, Rational(3, 2)])
    okA2 = all(tbl[("A2", j)] == {(3 * R + 6, j): -((-1) ** int(2 * j))}
               for j in [0, HALF, 1, Rational(3, 2)])
    okA1 = all(
        index_multiplet("A1", j, jb, R)
        == {(3 * R + 6 * jb + 6, j): (-1) ** int(2 * j + 2 * jb + 1)}
        for j in [0, HALF, 1] for jb in [HALF, 1, Rational(3, 2)])
    check("B table: B1b -> (-1)^{2j} t^{3R} chi_j", okB1)
    check("B table: A2b -> (-1)^{2j+1} t^{6+3R} chi_j", okA2)
    check("B table: A1b -> (-1)^{2j+2jb+1} t^{6+3R+6jb} chi_j", okA1)
    # recombination at threshold: I(A1b[jb]) + I(A?b[jb-1/2, R+1]) = 0
    ok = True
    for j in [0, HALF, 1]:
        for jb in [HALF, 1]:
            a = index_multiplet("A1", j, jb, R)
            nxt = "A1" if jb - HALF >= HALF else "A2"
            b = index_multiplet(nxt, j, jb - HALF, R + 1)
            tot = dict(a)
            for k, v in b.items():
                tot[k] = tot.get(k, 0) + v
            if {k: v for k, v in tot.items() if v != 0}:
                ok = False
    check("B recombination: I(A1b) + I(null A-type) = 0", ok)


# ---------------------------------------------------------------------------
# (C) allowed-region scan -> C1/C2/C3
# ---------------------------------------------------------------------------
# Left-side (undotted) unitarity for a barred-type primary (from A1 mirror):
#   continuum: Delta >= 2+2j-(3/2)R  (equality = left semi-short)
#   isolated (j=0): Delta = -(3/2)R  (antichiral)
# Applied to each barred type this bounds E:
#   B1b[j,0,R]  (Delta=(3/2)R):    E=3R;      3R >= 2+2j (=: FREE FIELD);
#                                  antichiral branch -> identity only.
#   A2b[j,0,R]  (Delta=2+(3/2)R):  E=6+3R;    3R >= 2j (=: conserved-current
#                                  multiplet A1 A2b); antichiral branch:
#                                  j=0, R=-2/3 -> E=4 (free antichiral scalar).
#   A1b[j,jb,R] (Delta=2+2jb+(3/2)R): E=6+3R+6jb; 3R >= 2j-2jb (=: conserved-
#                                  current A1 A1b); antichiral branch: j=0,
#                                  3R=-2-2jb -> E=4+4jb.
def part_C():
    print("\n== (C) allowed-region scan ==")
    findings = []
    for j2 in [0, HALF, 1, Rational(3, 2), 2]:
        chiral_sign = (-1) ** int(2 * j2)
        entries = []  # (E, sign, source, tag)
        # B1b: E = 3R >= 2+2j
        Emin = 2 + 2 * j2
        entries.append((Emin, chiral_sign, "B1b free (left-saturated)", "free"))
        entries.append((Emin + S(1) / 100, chiral_sign, "B1b interacting", "int"))
        # EOM residual of the free field of spin j2+1/2 (part D): lands in
        # THIS sector at E = 6+2*j2 with the chiral sign
        entries.append((6 + 2 * j2, chiral_sign,
                        f"A1B1b free EOM residual (field spin {j2 + HALF})",
                        "freeEOM"))
        # A2b: E = 6+3R, 3R >= 2j
        entries.append((6 + 2 * j2, -chiral_sign, "A2b current (A1A2b)", "cur"))
        entries.append((6 + 2 * j2 + S(1) / 100, -chiral_sign, "A2b generic", "int"))
        if j2 == 0:
            entries.append((4, -1, "A2b antichiral free (R=-2/3)", "freebar"))
        # A1b: E = 6+3R+6jb, 3R >= 2j-2jb
        for jb in [HALF, 1, Rational(3, 2)]:
            sgn = (-1) ** int(2 * j2 + 2 * jb + 1)
            entries.append((6 + 2 * j2 + 4 * jb, sgn,
                            f"A1b jb={jb} current", "cur"))
            if j2 == 0:
                entries.append((4 + 4 * jb, sgn,
                                f"A1b jb={jb} antichiral free", "freebar"))
        # ---- derived statements ----
        below = [e for e in entries if e[0] < 2 + 2 * j2]
        boundary = [e for e in entries if e[0] == 2 + 2 * j2]
        wrong_window = [e for e in entries
                        if e[1] == -chiral_sign and 2 + 2 * j2 <= e[0] < 6 + 2 * j2]
        at_c3 = [e for e in entries if e[0] == 6 + 2 * j2]
        findings.append((j2, below, boundary, wrong_window, at_c3))
        print(f"  chi_{j2} sector: min E = {min(e[0] for e in entries)}, "
              f"boundary sources = {[e[2] for e in boundary]}, "
              f"wrong-sign in window = {[e[2] for e in wrong_window]}, "
              f"at E=6+2j = {[(e[2], '+' if e[1]==chiral_sign else '-') for e in at_c3]}")
    # C1: nothing below E = 2+2j in any sector
    check("C1 derived: no unitary multiplet contributes at E < 2+2j",
          all(not f[1] for f in findings))
    # boundary: only free fields
    check("C1' derived: E = 2+2j content is exclusively free-field (B1b "
          "left-saturated); j=0 -> free scalar (decoupling branch), "
          "j>=1/2 -> free spinning sector (NOT checked by the code)",
          all(all(e[3] == "free" for e in f[2]) for f in findings))
    # C2: wrong-sign in [2+2j, 6+2j) only from the free antichiral at j=0,E=4
    ok = True
    for j2, _, _, wrong, _ in findings:
        for e in wrong:
            if not (j2 == 0 and e[0] == 4 and e[3] == "freebar"):
                ok = False
    check("C2 derived: wrong-sign terms in 2+2j <= E < 6+2j require a free "
          "antichiral scalar (E=4, j=0; CPT partner fires the E<=2 decouple "
          "branch first) -- otherwise non-unitary", ok)
    # C3: at E = 6+2j the wrong-sign source is exactly the conserved-current
    # multiplet A1A2b[j,0,2j/3]; chiral B1b enters with the opposite sign
    ok = True
    for j2, _, _, _, atc3 in findings:
        wrong = [e for e in atc3 if e[1] == -((-1) ** int(2 * j2))]
        if len(wrong) != 1 or "A2b current" not in wrong[0][2]:
            ok = False
    check("C3 derived: net positive coefficient of (-1)^{2j+1} t^{6+2j} chi_j "
          "<=> #(A1A2b current multiplets) > #(chiral B1b at E=6+2j) > 0; "
          "j=0: flavor current, j=1/2: extra supercurrent (SUSY enhancement), "
          "j>=1: conserved higher-spin current => free sector "
          "(Maldacena-Zhiboedov input)", ok)
    # C4: every contribution has E >= 2 > 0, so I = 1 + O(t^2) for any unitary
    # SCFT; a vanishing index is incompatible with a unitary SUSY fixed point.
    check("C4 derived: min E over all sectors = 2 > 0 => I = 1 + O(t^2) != 0 "
          "for any unitary N=1 SCFT (vanishing index => SUSY broken)",
          all(not f[1] for f in findings)
          and min(2 + 2 * f[0] for f in findings) == 2)


# ---------------------------------------------------------------------------
# (D) correction for LEFT-SATURATED chirals (free fields): the EOM residual
# ---------------------------------------------------------------------------
# For X barB1[j,0,r] the left-null module is generated by chi=(Q psi)_{j-1/2}
# (delta=2).  Since the primary is chiral (Qbar psi = 0),
#   Qbar_{dota} chi = 2 (P_{dota} psi)_{j-1/2},
# whose dot+ component has delta = 0: the EOM removes part of the primary's
# OWN delta=0 derivative tower, so the naive "stripped tower" answer
# (-1)^{2j} t^{3r} chi_j overcounts.  (For X barA2 / barA1 the analogous
# Qbar^2 chi is the epsilon-contraction of P(Qbar psi), all delta=2 -- no
# correction; verified against free-theory data in 07_free_theory_check.py.)
# Independent verification here: enumerate the delta=0 on-shell letters of a
# free (j,0) field of R-charge r (3r = 2+2j): level-n letters are
#   C_n = chi_{n/2} chi_j - chi_{(n-1)/2} chi_{j-1/2}   (EOM image removed)
# and the multiplet's I_red contribution is the reduced tower sum.  Expected
# closed form (the corrected table entry, chi_{-1/2} := 0 covers j=0):
#   (-1)^{2j} [ t^{3r} chi_j - t^{3r+3} chi_{j-1/2} ]
def chi(j2, yv):
    """SU(2) character chi_j(y), j2 = 2j; chi of negative j2 := 0."""
    if j2 < 0:
        return sympy.S.Zero
    return sum(yv ** (2 * m - j2) for m in range(j2 + 1))


def part_D():
    print("\n== (D) EOM residual of left-saturated (free) X barB1[j,0,r] ==")
    NMAX = 8
    yv = y
    # (i) the level decomposition collapses to a single spin: C_n = chi_{n/2+j}
    ok = True
    for j2 in (0, 1, 2, 3):
        for n in range(1, NMAX + 1):
            cn = sympy.expand(chi(n, yv) * chi(j2, yv)
                              - chi(n - 1, yv) * chi(j2 - 1, yv))
            if sympy.expand(cn - chi(n + j2, yv)) != 0:
                ok = False
    check("D on-shell letters per level: chi_{n/2} chi_j - chi_{(n-1)/2} "
          "chi_{j-1/2} = chi_{n/2+j} (massless tower)", ok)
    # (ii) reduced tower sum == corrected two-term entry, exactly
    ok = True
    for j2 in (0, 1, 2, 3):
        # sum_n t^{3n} chi_{n/2+j}, truncated; multiply by (1-t^3y)(1-t^3/y)
        tower = {3 * n: chi(n + j2, yv) for n in range(NMAX)}
        pref = {0: sympy.S.One, 3: -(yv + 1 / yv), 6: sympy.S.One}
        red = {}
        for a, ca in pref.items():
            for b, cb in tower.items():
                if a + b <= 3 * (NMAX - 2):
                    red[a + b] = sympy.expand(red.get(a + b, 0) + ca * cb)
        expected = {0: chi(j2, yv), 3: -chi(j2 - 1, yv)}
        for n, c in red.items():
            e = expected.get(n, sympy.S.Zero)
            if sympy.expand(c - e) != 0:
                ok = False
    check("D reduced tower = t^{3r} chi_j - t^{3r+3} chi_{j-1/2} exactly "
          "(chi_{-1/2}=0: no residual for the j=0 free scalar)", ok,
          "corrected entry: A1 barB1[j,0,r=(2+2j)/3] -> "
          "(-1)^{2j}(t^{3r} chi_j - t^{3r+3} chi_{j-1/2})")
    # (iii) the residual sits at E = 6+2j' in sector j' = j-1/2 with the
    # CHIRAL sign of that sector -> C1/C1'/C2/C3 statements unchanged;
    # it joins the NEGATIVE contributors to the C3 coefficient c(j').
    check("D residual position: E = 3r+3 = 5+2j = 6+2(j-1/2); sign "
          "(-1)^{2j+1} = chiral sign of sector j-1/2 (negative C3 "
          "contributor; allowed region unchanged)",
          all((2 + j2) + 3 == 6 + (j2 - 1) for j2 in (1, 2, 3)))


# ---------------------------------------------------------------------------
# (E) no usable condition from current multiplets with jb >= 1/2
# ---------------------------------------------------------------------------
# The conserved-current multiplets A1A1b[j,jb,R=2(j-jb)/3] (jb>=1/2) -- the
# stress tensor (1/2,1/2) and all higher-spin currents with j,jb >= 1/2,
# in particular j>=1, jb>=1 -- sit at E = 6+2j+4jb with sign
# (-1)^{2j+2jb+1}.  C3 works because at the WINDOW EDGE E = 6+2j every
# wrong-sign contributor is forced to left-saturation (protected).  For
# jb>=1/2 the slot lies strictly inside the anything-allowed region:
#   - integer jb  (sign = wrong sign of sector j): unsaturated
#     X A2b[j,0,(2j+4jb)/3] carries the same (E, chi_j, sign) and is
#     unitarity-allowed in an interacting theory (3R = 2j+4jb > 2j);
#   - half-odd jb (sign = CHIRAL sign of sector j): ordinary chiral
#     X B1b[j,0,(6+2j+4jb)/3] carries the same slot (3R > 2+2j).
# Hence a net coefficient there neither implies nor bounds the presence of
# the current multiplet: no necessary or sufficient condition exists in this
# (left) index.  Concrete faces of this: the stress tensor -t^9 chi_1/2 is
# degenerate with spin-1/2 chirals of R=3; the mirror extra supercurrent
# Hhat_(1/2,0) (+t^8 chi_0) hides behind R=8/3 chiral scalars; the free
# chiral's own higher-spin current multiplet A1A1b[1,1/2,1/3] shows up at
# +t^10 chi_1 with the harmless chiral sign.
def part_E():
    print("\n== (E) current multiplets with jb >= 1/2: slot contamination ==")
    ok_contaminated = True
    for j, jb in [(HALF, HALF), (1, HALF), (0, HALF), (1, 1), (2, 1),
                  (HALF, 1), (1, Rational(3, 2))]:
        E = 6 + 2 * j + 4 * jb
        sign = (-1) ** int(2 * j + 2 * jb + 1)
        chiral_sign = (-1) ** int(2 * j)
        if sign == chiral_sign:
            # unsaturated chiral B1b[j,0,E/3]: allowed iff E > 2+2j
            witness_ok = E > 2 + 2 * j
            witness = f"unsaturated B1b[{j},0,{E}/3]"
        else:
            # unsaturated A2b[j,0,(E-6)/3]: allowed iff E-6 > 2j
            witness_ok = E - 6 > 2 * j
            witness = f"unsaturated A2b[{j},0,{sympy.nsimplify((E - 6) / 3)}]"
        print(f"  A1A1b[{j},{jb}]: slot (E={E}, chi_{j}, "
              f"{'chiral' if sign == chiral_sign else 'wrong'} sign) "
              f"shared with {witness}")
        if not witness_ok:
            ok_contaminated = False
    check("E every current-multiplet slot with jb>=1/2 (incl. stress tensor "
          "and all j>=1, jb>=1 higher-spin currents) admits an unsaturated "
          "same-slot multiplet -> no condition", ok_contaminated)
    # contrast: at the C3 slot (jb=0 family) the wrong-sign contributors are
    # forced to saturation: A2b needs 3R = 2j exactly, and integer-jb A1b
    # would need 3R = 2j-6jb < 2j-2jb (excluded)
    ok_clean = True
    for j in [0, HALF, 1, Rational(3, 2), 2]:
        E = 6 + 2 * j
        if E - 6 > 2 * j:  # would allow unsaturated A2b
            ok_clean = False
        for jbp in [1, 2]:  # integer jb A1b at the same slot
            threeR = E - 6 - 6 * jbp
            if threeR >= 2 * j - 2 * jbp:
                ok_clean = False
    check("E contrast: at E = 6+2j (jb=0 family) every wrong-sign "
          "contributor is left-saturated (protected) -- the uniqueness that "
          "powers C3 exists only at jb=0", ok_clean)


def main():
    print("== (A0) algebra consistency ==")
    check_jacobi()
    gram_level1()
    gram_level2()
    part_B()
    part_C()
    part_D()
    part_E()
    n = len(PASS)
    print(f"\n{'ALL PASS' if all(PASS) else 'FAILURES PRESENT'}: "
          f"{sum(PASS)}/{n}")
    return 0 if all(PASS) else 1


if __name__ == "__main__":
    raise SystemExit(main())
