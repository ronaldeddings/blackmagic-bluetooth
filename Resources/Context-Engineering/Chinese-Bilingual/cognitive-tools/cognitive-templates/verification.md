# Verification Templates  验证模板

[](https://github.com/KashiwaByte/Context-Engineering-Chinese-Bilingual/blob/main/Chinese-Bilingual/cognitive-tools/cognitive-templates/verification.md#verification-templates)

> "Trust, but verify." — Russian proverb  
> “信任，但要核实。”——俄罗斯谚语

## Overview  概述

[](https://github.com/KashiwaByte/Context-Engineering-Chinese-Bilingual/blob/main/Chinese-Bilingual/cognitive-tools/cognitive-templates/verification.md#overview)

Verification templates help language models check their own work, catch errors, and ensure the quality of their outputs. These templates are crucial for increasing reliability, reducing hallucinations, and improving overall accuracy.  
验证模板可帮助语言模型检查自身工作、发现错误并确保输出质量。这些模板对于提高可靠性、减少错觉并提升整体准确性至关重要。

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│  VERIFICATION PROCESS                                        │
│                                                              │
│  Solution → Check Logic → Test Assumptions → Correct → Final │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

## Basic Templates  基本模板

[](https://github.com/KashiwaByte/Context-Engineering-Chinese-Bilingual/blob/main/Chinese-Bilingual/cognitive-tools/cognitive-templates/verification.md#basic-templates)

### 1. Solution Verification  1. 解决方案验证

[](https://github.com/KashiwaByte/Context-Engineering-Chinese-Bilingual/blob/main/Chinese-Bilingual/cognitive-tools/cognitive-templates/verification.md#1-solution-verification)

The fundamental template for checking a solution or answer.  
检查解决方案或答案的基本模板。

```md
# Solution Verification Template

Task: Verify the correctness of the following solution.

Problem: {{problem}}
Proposed Solution: {{solution}}

Please follow this verification process:
1. **Restate the Problem**: Confirm understanding of what was asked.
2. **Check Methodology**: Is the approach used appropriate for this problem?
3. **Verify Calculations**: Check all mathematical operations for accuracy.
4. **Check Logic**: Examine the reasoning for logical errors or gaps.
5. **Test with Examples**: Test the solution with specific examples or edge cases.
6. **Check Constraints**: Ensure all constraints from the original problem are satisfied.
7. **Final Assessment**: State whether the solution is:
   - Correct: The solution is completely accurate
   - Partially Correct: The solution has minor errors (specify)
   - Incorrect: The solution has major flaws (specify)

If errors are found, explain them clearly and suggest corrections.
```

**Token Count**: ~160 tokens (template only)  
**令牌数量** ：~160 个令牌（仅模板）

**Usage Example**:  
**使用示例** ：

- For mathematical solutions  
    对于数学解决方案
- When checking logical arguments  
    检查逻辑论证时
- For any output where accuracy is crucial  
    对于任何准确性至关重要的输出

### 2. Fact Checking  2. 事实核查

[](https://github.com/KashiwaByte/Context-Engineering-Chinese-Bilingual/blob/main/Chinese-Bilingual/cognitive-tools/cognitive-templates/verification.md#2-fact-checking)

For verifying factual claims and statements.  
用于验证事实主张和陈述。

```md
# Fact Checking Template

Task: Verify the accuracy of the following statement(s).

Statement(s): {{statements}}

Please follow this verification process:
1. **Break Down Claims**: Identify each distinct factual claim.
2. **Assess Knowledge Base**: Determine if you have reliable information about each claim.
3. **Verify Each Claim**:
   - Claim 1: [Restate the claim]
     - Assessment: [Accurate / Inaccurate / Partially Accurate / Uncertain]
     - Explanation: [Provide relevant facts and context]
     - Confidence: [High / Medium / Low]
   - Claim 2: [Continue for each claim]
4. **Check for Omissions**: Identify any relevant context that's missing.
5. **Overall Assessment**: Summarize the overall accuracy.
6. **Knowledge Limitations**: Note any claims you cannot verify with confidence.

Provide corrections for any inaccurate information.
```

**Token Count**: ~150 tokens (template only)  
**令牌数量** ：~150 个令牌（仅模板）

**Usage Example**:  
**使用示例** ：

- For checking historical or scientific claims  
    用于核实历史或科学主张
- When verifying information in summaries  
    验证摘要中的信息时
- For any output containing factual assertions  
    对于任何包含事实断言的输出

### 3. Consistency Check  3.一致性检查

[](https://github.com/KashiwaByte/Context-Engineering-Chinese-Bilingual/blob/main/Chinese-Bilingual/cognitive-tools/cognitive-templates/verification.md#3-consistency-check)

For ensuring internal consistency in content.  
为了确保内容的内部一致性。

```md
# Consistency Check Template

Task: Check the following content for internal consistency.

Content: {{content}}

Please follow this verification process:
1. **Identify Key Elements**: Note the main claims, definitions, and arguments.
2. **Create Consistency Map**:
   - Element 1: [Description]
   - Element 2: [Description]
   - [Continue for all important elements]
3. **Check for Contradictions**:
   - Between Elements: Compare each element with others for compatibility
   - Within Elements: Check each element for internal contradictions
4. **Temporal Consistency**: Ensure events and developments follow a logical timeline.
5. **Terminology Consistency**: Verify that terms are used consistently throughout.
6. **Logical Flow**: Check that conclusions follow from premises.
7. **Final Assessment**: Summarize any inconsistencies found.

For each inconsistency, explain the contradiction and suggest a resolution.
```

**Token Count**: ~160 tokens (template only)  
**令牌数量** ：~160 个令牌（仅模板）

**Usage Example**:  
**使用示例** ：

- For long-form content  对于长篇内容
- When checking complex arguments  
    检查复杂参数时
- For any output that builds on multiple premises  
    对于任何基于多个前提的输出

## Advanced Templates  高级模板

[](https://github.com/KashiwaByte/Context-Engineering-Chinese-Bilingual/blob/main/Chinese-Bilingual/cognitive-tools/cognitive-templates/verification.md#advanced-templates)

### 4. Comprehensive Error Analysis  
4. 综合误差分析

[](https://github.com/KashiwaByte/Context-Engineering-Chinese-Bilingual/blob/main/Chinese-Bilingual/cognitive-tools/cognitive-templates/verification.md#4-comprehensive-error-analysis)

For detailed examination of potential errors across multiple dimensions.  
用于详细检查跨多个维度的潜在错误。

```md
# Comprehensive Error Analysis Template

Task: Perform a thorough error analysis on the following content.

Content: {{content}}
Context: {{context}}

Please examine for these error types:
1. **Factual Errors**:
   - Incorrect statements: [Identify and correct]
   - Outdated information: [Identify and update]
   - Misattributed statements: [Identify and correct]

2. **Logical Errors**:
   - False equivalences: [Identify]
   - Non sequiturs: [Identify]
   - Circular reasoning: [Identify]
   - Hasty generalizations: [Identify]

3. **Mathematical/Computational Errors**:
   - Calculation mistakes: [Identify and correct]
   - Formula application errors: [Identify and correct]
   - Unit conversion issues: [Identify and correct]

4. **Contextual Errors**:
   - Misunderstanding of context: [Clarify]
   - Inappropriate assumptions: [Identify]
   - Missing relevant information: [Supply]

5. **Linguistic Errors**:
   - Ambiguous statements: [Clarify]
   - Incorrect terminology: [Correct]
   - Inconsistent language: [Standardize]

6. **Structural Errors**:
   - Organizational problems: [Identify]
   - Missing components: [Identify]
   - Redundancies: [Identify]

For each error found, explain:
- What the error is
- Why it's problematic
- How it should be corrected

Conclude with an overall assessment of the content's accuracy and reliability.
```

**Token Count**: ~240 tokens (template only)  
**令牌数量** ：~240 个令牌（仅模板）

**Usage Example**:  
**使用示例** ：

- For critical review of important content  
    用于对重要内容进行批判性审查
- When maximum accuracy is required  
    当需要最高精度时
- For peer review or editorial processes  
    用于同行评审或编辑流程

### 5. Alternative Perspective Analysis  
5. 替代视角分析

[](https://github.com/KashiwaByte/Context-Engineering-Chinese-Bilingual/blob/main/Chinese-Bilingual/cognitive-tools/cognitive-templates/verification.md#5-alternative-perspective-analysis)

For checking bias and exploring alternative viewpoints.  
用于检查偏见和探索其他观点。

```md
# Alternative Perspective Analysis Template

Task: Analyze the following content from alternative perspectives to check for bias or blind spots.

Content: {{content}}

Please follow this process:
1. **Identify the Content's Perspective**: What worldview, assumptions, or values underlie the content?

2. **Explore Alternative Perspectives**:
   - Perspective A: [Description of a different viewpoint]
     - How would this perspective view the content?
     - What would it critique or question?
     - What additional considerations would it raise?
   
   - Perspective B: [Description of another different viewpoint]
     - How would this perspective view the content?
     - What would it critique or question?
     - What additional considerations would it raise?
   
   - [Continue with additional relevant perspectives]

3. **Identify Blind Spots**: What important considerations are missing from the original content?

4. **Check for Unstated Assumptions**: What does the content take for granted that might be questioned?

5. **Balance Assessment**: Is the content fair and balanced, or does it favor certain perspectives?

6. **Recommendations**: Suggest modifications that would make the content more comprehensive and balanced.

This analysis helps ensure that the content accounts for diverse viewpoints and avoids unintentional bias.
```

**Token Count**: ~220 tokens (template only)  
**令牌数量** ：~220 个令牌（仅模板）

**Usage Example**:  
**使用示例** ：

- For policy analysis  用于政策分析
- When checking for cultural or ideological bias  
    在检查文化或意识形态偏见时
- For any content addressing controversial topics  
    对于涉及争议话题的任何内容

### 6. Implementation Verification  
6.实施验证

[](https://github.com/KashiwaByte/Context-Engineering-Chinese-Bilingual/blob/main/Chinese-Bilingual/cognitive-tools/cognitive-templates/verification.md#6-implementation-verification)

For checking that a solution can actually be implemented.  
用于检查解决方案是否真的可以实施。

```md
# Implementation Verification Template

Task: Verify that the following solution can be practically implemented.

Proposed Solution: {{solution}}
Implementation Context: {{context}}

Please follow this verification process:
1. **Feasibility Assessment**:
   - Technical feasibility: Can this be built with available technology?
   - Resource requirements: What resources (time, money, skills) would be needed?
   - Scalability: Would the solution work at the required scale?

2. **Constraints Check**:
   - Technical constraints: Does the solution respect technical limitations?
   - Regulatory constraints: Does it comply with relevant regulations?
   - Operational constraints: Can it be implemented within operational parameters?

3. **Risk Analysis**:
   - Implementation risks: What could go wrong during implementation?
   - Operational risks: What could go wrong once implemented?
   - Mitigation strategies: How could these risks be addressed?

4. **Dependency Analysis**:
   - External dependencies: What does this solution depend on?
   - Critical path: Which dependencies are on the critical path?
   - Vulnerability points: Where could dependencies cause problems?

5. **Testing Approach**:
   - Validation methods: How could the implementation be tested?
   - Success criteria: How would success be measured?
   - Failure scenarios: How would failures be detected and addressed?

6. **Overall Assessment**: Is the solution implementable as described? What modifications would improve implementability?

This verification ensures that solutions are not just theoretically sound but practically viable.
```

**Token Count**: ~240 tokens (template only)  
**令牌数量** ：~240 个令牌（仅模板）

**Usage Example**:  
**使用示例** ：

- For engineering solutions  
    对于工程解决方案
- When evaluating project proposals  
    在评估项目提案时
- For any solution that requires practical implementation  
    对于任何需要实际实施的解决方案

## Implementation Patterns  实现模式

[](https://github.com/KashiwaByte/Context-Engineering-Chinese-Bilingual/blob/main/Chinese-Bilingual/cognitive-tools/cognitive-templates/verification.md#implementation-patterns)

Here's a simple Python function to implement the Solution Verification template:  
下面是一个用于实现解决方案验证模板的简单 Python 函数：

```python
def verify_solution(problem, solution):
    """
    Create a prompt that verifies a proposed solution.
    
    Args:
        problem (str): The original problem
        solution (str): The proposed solution to verify
        
    Returns:
        str: A formatted prompt for solution verification
    """
    return f"""
Task: Verify the correctness of the following solution.

Problem: {problem}
Proposed Solution: {solution}

Please follow this verification process:
1. **Restate the Problem**: Confirm understanding of what was asked.
2. **Check Methodology**: Is the approach used appropriate for this problem?
3. **Verify Calculations**: Check all mathematical operations for accuracy.
4. **Check Logic**: Examine the reasoning for logical errors or gaps.
5. **Test with Examples**: Test the solution with specific examples or edge cases.
6. **Check Constraints**: Ensure all constraints from the original problem are satisfied.
7. **Final Assessment**: State whether the solution is:
   - Correct: The solution is completely accurate
   - Partially Correct: The solution has minor errors (specify)
   - Incorrect: The solution has major flaws (specify)

If errors are found, explain them clearly and suggest corrections.
"""
```

## Self-Correction Loop  自我修正循环

[](https://github.com/KashiwaByte/Context-Engineering-Chinese-Bilingual/blob/main/Chinese-Bilingual/cognitive-tools/cognitive-templates/verification.md#self-correction-loop)

One of the most powerful applications of verification templates is the self-correction loop:  
验证模板最强大的应用之一是自我修正循环：

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  Initial Solution                                                   │
│       │                                                             │
│       ▼                                                             │
│  Apply Verification Template                                        │
│       │                                                             │
│       ▼                                                             │
│  Errors Found?                                                      │
│       │                                                             │
│       ├─────────────Yes─────────────┐                               │
│       │                             │                               │
│       ▼                             ▼                               │
│  No   │                        Apply Corrections                    │
│       │                             │                               │
│       ▼                             ▼                               │
│  Final Verified Solution ◄──────────┘                               │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

Implementation example:  实现示例：

```python
def self_correction_loop(problem, max_iterations=3):
    """
    Implement a self-correction loop for problem solving.
    
    Args:
        problem (str): The problem to solve
        max_iterations (int): Maximum number of correction iterations
        
    Returns:
        dict: The final solution and verification history
    """
    # Initial solution
    solution = llm.generate(f"Solve this problem: {problem}")
    
    history = [{"type": "solution", "content": solution}]
    iteration = 0
    
    while iteration < max_iterations:
        # Verify the current solution
        verification = llm.generate(verify_solution(problem, solution))
        history.append({"type": "verification", "content": verification})
        
        # Check if corrections are needed
        if "Correct: The solution is completely accurate" in verification:
            break
        
        # Generate corrected solution
        correction_prompt = f"""
        Based on the verification feedback below, provide a corrected solution to the original problem.
        
        Original Problem: {problem}
        
        Previous Solution: {solution}
        
        Verification Feedback: {verification}
        
        Please provide a fully corrected solution that addresses all issues identified in the verification.
        """
        
        corrected_solution = llm.generate(correction_prompt)
        history.append({"type": "correction", "content": corrected_solution})
        
        # Update solution for next iteration
        solution = corrected_solution
        iteration += 1
    
    return {
        "problem": problem,
        "final_solution": solution,
        "verification_history": history,
        "iterations": iteration
    }
```

## Measurement and Optimization  
测量与优化

[](https://github.com/KashiwaByte/Context-Engineering-Chinese-Bilingual/blob/main/Chinese-Bilingual/cognitive-tools/cognitive-templates/verification.md#measurement-and-optimization)

When using verification templates, measure their effectiveness by:  
使用验证模板时，通过以下方式衡量其有效性：

1. **Error Detection Rate**: What percentage of injected errors are caught?  
    **错误检测率** ：捕获到的注入错误百分比是多少？
2. **False Positive Rate**: How often are correct elements incorrectly flagged?  
    **误报率** ：正确元素被错误标记的频率是多少？
3. **Correction Quality**: How effective are the suggested corrections?  
    **修正质量** ：建议的修正效果如何？
4. **Iteration Efficiency**: How many iterations to reach a correct solution?  
    **迭代效率** ：需要多少次迭代才能得到正确的解决方案？

Optimize your templates by:  
通过以下方式优化您的模板：

- Adding domain-specific verification steps for specialized fields  
    为专业领域添加特定领域的验证步骤
- Tuning the level of scrutiny based on the importance of accuracy  
    根据准确性的重要性调整审查级别
- Focusing on common error types for particular tasks  
    关注特定任务的常见错误类型

## Combining with Other Tools  
与其他工具结合

[](https://github.com/KashiwaByte/Context-Engineering-Chinese-Bilingual/blob/main/Chinese-Bilingual/cognitive-tools/cognitive-templates/verification.md#combining-with-other-tools)

Verification templates complete the cognitive workflow:  
验证模板完成认知工作流程：

```
┌─────────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                     │     │                 │     │                 │
│ Understanding       │────►│ Reasoning       │────►│ Verification    │
│ Template            │     │ Template        │     │ Template        │
│                     │     │                 │     │                 │
└─────────────────────┘     └─────────────────┘     └─────────────────┘
          ▲                                                │
          │                                                │
          └────────────────────────────────────────────────┘
                        (Correction Loop)
```

This creates a complete cognitive system that can:  
这创建了一个完整的认知系统，可以：

1. Understand a problem  理解问题
2. Generate a solution  生成解决方案
3. Verify and correct the solution  
    验证并更正解决方案
4. Iterate until a satisfactory result is achieved  
    迭代直至获得满意的结果

## Next Steps  后续步骤

[](https://github.com/KashiwaByte/Context-Engineering-Chinese-Bilingual/blob/main/Chinese-Bilingual/cognitive-tools/cognitive-templates/verification.md#next-steps)

- Explore [composition.md](https://github.com/KashiwaByte/Context-Engineering-Chinese-Bilingual/blob/main/Chinese-Bilingual/cognitive-tools/cognitive-templates/composition.md) for ways to combine multiple templates  
    探索 [Composition.md](https://github.com/KashiwaByte/Context-Engineering-Chinese-Bilingual/blob/main/Chinese-Bilingual/cognitive-tools/cognitive-templates/composition.md) 以了解组合多个模板的方法
- See how these templates can be integrated into complete cognitive programs in [../cognitive-programs/basic-programs.md](https://github.com/KashiwaByte/Context-Engineering-Chinese-Bilingual/blob/main/Chinese-Bilingual/cognitive-tools/cognitive-programs/basic-programs.md)  
    了解如何将这些模板集成到完整的认知程序中 [。../](https://github.com/KashiwaByte/Context-Engineering-Chinese-Bilingual/blob/main/Chinese-Bilingual/cognitive-tools/cognitive-programs/basic-programs.md) cognitive-programs/basic-programs.md
- Learn about complete cognitive architectures in [../cognitive-architectures/solver-architecture.md](https://github.com/KashiwaByte/Context-Engineering-Chinese-Bilingual/blob/main/Chinese-Bilingual/cognitive-tools/cognitive-architectures/solver-architecture.md)  
    了解完整的认知架构，请访问 [../cognitive-architectures/solver-architecture.md](https://github.com/KashiwaByte/Context-Engineering-Chinese-Bilingual/blob/main/Chinese-Bilingual/cognitive-tools/cognitive-architectures/solver-architecture.md)