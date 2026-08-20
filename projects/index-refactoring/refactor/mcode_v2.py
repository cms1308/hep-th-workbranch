"""Mathematica post-processing generators with the F3/F4 fixes (step-8).

Byte-for-byte copies of generate_decouple_mcode / generate_index_mcode from
landscape_refactored.py with exactly two surgical changes each:

  F3: extractScalar peeled SU(2)_y characters using the ORIGINAL
      coefficients for every level; characters of the same parity overlap,
      so any content with top y-power >= 3 was over-subtracted
      (notes/02, case G).  Fixed by an iterative top-down peel that
      recomputes the coefficient after each subtraction.  Identical output
      for content with top y-power <= 2 (parity separation), which covers
      the entire regression baseline.

  F4: the rounding rule (b_ * c_) :> Round[b, 1]*c bound b to the first
      Times factor, which is the numeric coefficient only under the
      "explicit float coefficient" convention of the old match(); a bare
      integer-coefficient monomial produced unevaluated Round[t^6, 1] junk.
      Fixed by constraining the pattern to b_?NumericQ: identical output on
      well-formed terms, and a term with no numeric coefficient (exact
      coefficient 1, as the exact-rational express files of fastmatch can
      produce) is left unchanged instead of corrupted.
"""

_EXTRACT_SCALAR_V2 = (
    "extractScalar[poly_, p_] := Module[{qq = Expand[poly], kk}, "
    "Do[qq = Expand[qq - Coefficient[qq, y^kk]*Sum[y^j, {j, -kk, kk, 2}]], "
    "{kk, p, 1, -1}]; qq];"
)


def generate_decouple_mcode(pid: int, vars_str: str, t_order: float,
                            w2: str, user_dir) -> str:
    return rf"""
res = ToExpression[Import["{user_dir}/frm/express{pid}.txt"]];
var = {vars_str} // Sort;
res2 = Total[res];

reduced = ((1 - t^3 y) (1 - t^3/y) (res2 - 1) // Expand ) /. {{0. -> 0}};
fug2Rule = {{}};
If[SameQ[reduced, 0],
    result = <|"decoupled" -> {{}}, "consistency" -> "consistent"|>;
,
    (* 다항식을 리스트로 안전하게 변환 후 Select 적용 (Expand+Select 병목 해결) *)
    reducedList = If[Head[reduced] === Plus, List @@ reduced, {{reduced}}];
    reduced = Total @ Replace[
        Select[reducedList, Exponent[#, t] < {t_order} &],
        (b_?NumericQ * c_) :> Round[b, 1] * c,
        {{1}}
    ];

    (* MemberQ를 이용한 필터링 *)
    fugacity = Select[var, !MemberQ[{{t, y, s}}, #] && !StringStartsQ[ToString[#], "g"] &];
    fugacity2 = Select[var, !MemberQ[{{t, y}}, #] &];

    (* 치환 규칙(Rule)을 미리 생성하여 연산 속도 극대화 *)
    fugRule = Thread[fugacity -> 1];
    fug2Rule = Thread[fugacity2 -> 1];

    reduced2 = reduced /. fugRule;
    w = ToExpression[#] & /@ {w2};

    If[SameQ[reduced2, 0],
        result = <|"decoupled" -> {{}}, "consistency" -> "consistent"|>;
    ,
        result = <||>;
        power = IntegerPart[Exponent[reduced, y]];
        power2 = IntegerPart[Exponent[reduced2, y]];

        (* SU(2) scalar 만 남기는 함수 -- F3 fix: iterative peel *)
        {_EXTRACT_SCALAR_V2}

        scalars = Expand[extractScalar[reduced, power]];
        unrefinedscalars = Expand[extractScalar[reduced2, power2]];

        If[SameQ[unrefinedscalars, 0],
            result = Join[result, <|"decoupled" -> {{}}, "relevant" -> {{}}, "fliped" -> {{}}|>];
        ,
            (* Exponents 추출 최적화 *)
            exponents = Select[Sort[Exponent[#, t] & /@ If[Head[#] === Plus, List @@ #, {{#}}] & @ (1 + (unrefinedscalars /. fug2Rule))], 0 < # < 6 &];

            scalarletter = Flatten[If[Head[#] === Plus, List @@ #, {{#}}] & /@ (Coefficient[scalars, t^#] & /@ exponents)];

            (* Exponent 벡터화 연산 (For 루프 없이 한 번에 최솟값 추출) *)
            fermion = Min[Exponent[scalarletter, #]] & /@ fugacity;

            (* F-term condition *)
            wcond2 = Flatten @ Table[
                If[fermion[[i]] < 0,
                    With[{{f = fugacity[[i]]}},
                        With[{{wMatch = SelectFirst[w, MemberQ[Variables[#], f] &]}},
                            Table[f^j -> (wMatch/f)^-j, {{j, fermion[[i]], -1}}]
                        ]
                    ],
                    Nothing
                ],
                {{i, 1, Length[fugacity]}}
            ];

            If[exponents[[1]] <= 2,
                decoupled = Select[Flatten[If[Head[#] === Plus, List @@ #, {{#}}] & @ (Coefficient[scalars, t^exponents[[1]]] /. wcond2 )],(2 #)[[1]] > 0 &];
                decoupled = (# / (# /. fugRule)) & /@ decoupled;
                result = Join[result, <|"decoupled" -> (ToString[InputForm[#]] & /@ decoupled), "consistency" -> "consistent"|>];
            ,
                result = Join[result, <|"decoupled" -> {{}}, "consistency" -> "consistent"|>];
            ];
        ];
    ];
];

result = Join[result, <|
    "full index" -> ToString[InputForm[reduced2]],
    "index" -> ToString[InputForm[reduced2 /. fug2Rule]]
|>];
Print[ExportString[result, "PythonExpression"]]
"""


def generate_index_mcode(pid: int, vars_str: str, t_order: float,
                         w2: str, user_dir) -> str:
    return rf"""
res = ToExpression[Import["{user_dir}/frm/express{pid}.txt"]];
var = {vars_str} // Sort;
res2 = Total[res];

reduced = ((1 - t^3 y) (1 - t^3/y) (res2 - 1) // Expand ) /. {{0. -> 0}};
fug2Rule = {{}};
toList[expr_] := If[Head[expr] === Plus, List @@ expr, If[Head[expr] === List, expr, If[expr === 0, {{}}, {{expr}}]]];

reducedList = toList[reduced];
reduced2 = Total @ Replace[
    Select[reducedList, Exponent[#, t] < {t_order} &],
    (b_?NumericQ * c_) :> Round[b, 1] * c,
    {{1}}
];

(* MemberQ를 이용한 초고속 필터링 (TraditionalForm 제거) *)
fugacity = Select[var, !MemberQ[{{t, y, s}}, #] && !StringStartsQ[ToString[#], "g"] &];
fugacity2 = Select[var, !MemberQ[{{t, y}}, #] &];

fugRule = Thread[fugacity -> 1];
fug2Rule = Thread[fugacity2 -> 1];
fug3Rule = Thread[var -> 1];

reduced3 = reduced2 /. fugRule;
w = ToExpression[#] & /@ {w2};

(* 미세 소수점 오차 보정 *)
fracRule = {{t^pow_ :> t^(Round[1000 * pow, 1]/1000 // N)}};
index = reduced2 /. fracRule;
index2 = reduced3 /. fracRule;

result = <||>;
power = IntegerPart[Exponent[index2, y]];
fullpower = IntegerPart[Exponent[index, y]];

(* SU(2) scalar 만 남기는 함수 -- F3 fix: iterative peel *)
{_EXTRACT_SCALAR_V2}

fullscalar = extractScalar[index, fullpower];
indexscalar = extractScalar[index2, power];
indexspinor = Expand[Total[Coefficient[index2, y^#] * (y^#) & /@ Range[power, 1, -1]]];

(* zz가 사라지고 코드가 매우 직관적으로 변함 *)
exponents = Select[
    {{# /. t -> 1, Exponent[#, t]}} & /@ toList[indexscalar /. fugRule],
    0 < #[[2]] < 6 &
];
exponents2 = Select[Sort[Exponent[#, t] & /@ toList[fullscalar]], # == 6 &];

(* 1. Consistency 검사 *)
consistency = "consistent";
If[AnyTrue[toList[indexscalar], Exponent[#, t] < 6 && (# /. fug3Rule) < 0 &],
    consistency = "inconsistent";
,
    If[! SameQ[indexspinor, 0],
        If[AnyTrue[Range[power, 1, -1], Min[Exponent[toList[Coefficient[indexspinor, y^#]], t]] < 2 + # &],
            consistency = "inconsistent";
        ,
            If[AnyTrue[toList[indexspinor], Exponent[#, t] < (6 + Abs[Exponent[#, y]]) && (#/Abs[#] /. fug3Rule) == (-1)^(1 + Abs[Exponent[#, y]]) &],
                consistency = "inconsistent";
            ];
        ];
    ];
];
result = Join[result, <|"consistency" -> consistency|>];

(* 2. Decoupled, Relevant, Fliped, Marginal 연산 *)
If[Length[exponents] == 0,
    result = Join[result, <|"decoupled" -> {{}}, "relevant" -> {{}}, "fliped" -> {{}}|>];
,
    l = Flatten[toList[Coefficient[fullscalar, t^#[[2]]]] & /@ exponents];
    fermion = Min[Exponent[l, #]] & /@ Variables[w];

    wcond2 = Flatten @ Table[
        If[fermion[[i]] < 0,
            With[{{f = Variables[w][[i]]}},
                With[{{wMatch = SelectFirst[w, MemberQ[Variables[#], f] &]}},
                    Table[f^j -> (wMatch/f)^-j, {{j, fermion[[i]], -1}}]
                ]
            ],
            Nothing
        ],
        {{i, 1, Length[Variables[w]]}}
    ];

    If[exponents[[1, 2]] <= 2,
        decoupled = Select[Flatten[toList[Coefficient[fullscalar, t^#] /. wcond2] & /@ {{exponents[[1, 2]]}}], (2 #)[[1]] > 0 &];
        decoupled = (# / (# /. fugRule)) & /@ decoupled;
        result = Join[result, <|"decoupled" -> (ToString[InputForm[#]] & /@ decoupled)|>];
    ,
        If[consistency == "inconsistent",
            result = Join[result, <|"decoupled" -> {{}}|>];
        ,
            relevant = {{}}; fliped = {{}};

            For[exp = 1, exp <= Length[exponents], exp++,
                termList = toList[Coefficient[fullscalar, t, exponents[[exp, 2]]] /. wcond2];
                If[NumberQ[exponents[[exp, 1]]],
                    AppendTo[relevant, Select[termList, (2 #)[[1]] > 0 &]];
                    If[exponents[[exp, 2]] < 4, AppendTo[fliped, Select[termList, (2 #)[[1]] > 0 &]]];
                ,
                    validTerms = Select[termList, (2 #)[[1]] > 0 &];
                    cond[val_] := NumberQ[(val /. fugRule) / Select[exponents[[exp, 1]], !NumberQ[#] &]];
                    AppendTo[relevant, Select[validTerms, cond]];
                    If[exponents[[exp, 2]] < 4, AppendTo[fliped, Select[validTerms, cond]]];
                ];
            ];

            relevant = (# / (# /. fugRule)) & /@ Flatten[relevant];
            fliped = (# / (# /. fugRule)) & /@ Flatten[fliped];

            coef = 0; marginal = {{}}; dim3 = 0;
            If[Length[exponents2] > 0,
                l2 = Flatten[toList[Coefficient[fullscalar, t^#]] & /@ exponents2[[1 ;; 1]]];
                fermion2 = Min[Exponent[l2, #]] & /@ Variables[w];
                wcond3 = Flatten @ Table[
                    If[fermion2[[i]] < 0,
                        With[{{f = Variables[w][[i]]}},
                            With[{{wMatch = SelectFirst[w, MemberQ[Variables[#], f] &]}},
                                Table[f^j -> (wMatch/f)^-j, {{j, fermion2[[i]], -1}}]
                            ]
                        ],
                        Nothing
                    ],
                    {{i, 1, Length[Variables[w]]}}
                ];

                coef = Coefficient[fullscalar /. wcond3 /. Thread[w -> 1], t^exponents2[[1]]];
                gRule = Thread[Select[var, StringStartsQ[ToString[#], "g"] &] -> 1];

                If[NumberQ[coef /. gRule],
                    coef = coef /. gRule;
                ,
                    coef2 = Select[toList[coef], !NumberQ[# /. gRule] &];
                    coef = Select[toList[coef /. gRule], NumberQ[# /. gRule] &];
                    marginal = Select[toList[coef2 /. gRule], (2 #)[[1]] > 0 &];
                ];
                dim3 = Coefficient[indexscalar /. fug2Rule, t^exponents2[[1]]];
            ];

            gsym = Length[Select[var, StringStartsQ[ToString[#], "g"] &]];
            nonmanifest = If[gsym + Total[Flatten[toList[coef]]] < 0, "yes", "no"];

            result = Join[result, <|
                "decoupled" -> {{}},
                "relevant" -> (ToString[InputForm[#]] & /@ relevant),
                "fliped" -> (ToString[InputForm[#]] & /@ fliped),
                "marginal" -> (ToString[InputForm[#]] & /@ marginal),
                "dim3" -> dim3,
                "non-manifest symmetry" -> nonmanifest
            |>];
        ];
    ];
];

result = Join[result, <|
    "full index" -> ToString[InputForm[index2]],
    "index" -> ToString[InputForm[index2 /. fug2Rule]],
    "shortindex" -> ToString[InputForm[Total[Select[toList[index2], Exponent[#, t] <= 6 &]] /. fug2Rule]]
|>];
Print[ExportString[result, "PythonExpression"]]
"""
