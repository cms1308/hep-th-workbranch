"""Step-8 refactored index pipeline for the 4d N=1 landscape code.

Modules:
  fastmatch  - structured FORM-output parser + gauge-singlet projection
               (replaces the sympy eval/subs decode of Mathcode/match)
  conditions - reduced-index scan: chi_j decomposition, C1'/C3/C4 checks
  mcode_v2   - Mathematica post-processing generators with the F3/F4 fixes
  glue       - install() overlay wiring the above into the landscape module

See refactor/README.md for integration instructions.
"""
