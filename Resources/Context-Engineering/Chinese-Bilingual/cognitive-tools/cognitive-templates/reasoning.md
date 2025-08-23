# Reasoning Templates  推理模板

[](https://github.com/KashiwaByte/Context-Engineering-Chinese-Bilingual/blob/main/Chinese-Bilingual/cognitive-tools/cognitive-templates/reasoning.md#reasoning-templates)

> "Logic is the anatomy of thought." — John Locke  
> “逻辑是思想的解剖学。”——约翰·洛克

## Overview  概述

[](https://github.com/KashiwaByte/Context-Engineering-Chinese-Bilingual/blob/main/Chinese-Bilingual/cognitive-tools/cognitive-templates/reasoning.md#overview)

Reasoning templates guide language models through structured thinking processes to solve problems, generate insights, or make decisions. These templates build upon understanding templates by providing systematic approaches to processing information and reaching conclusions.  
推理模板引导语言模型通过结构化的思维过程来解决问题、产生洞察或做出决策。这些模板以理解模板为基础，提供系统化的方法来处理信息并得出结论。

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│  REASONING PROCESS                                           │
│                                                              │
│  Input → Structure → Apply Logic → Step-by-Step → Conclusion │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

## Basic Templates  基本模板

[](https://github.com/KashiwaByte/Context-Engineering-Chinese-Bilingual/blob/main/Chinese-Bilingual/cognitive-tools/cognitive-templates/reasoning.md#basic-templates)

### 1. Step-by-Step Reasoning  
1.逐步推理

[](https://github.com/KashiwaByte/Context-Engineering-Chinese-Bilingual/blob/main/Chinese-Bilingual/cognitive-tools/cognitive-templates/reasoning.md#1-step-by-step-reasoning)

The fundamental template for breaking down complex reasoning into manageable steps.  
将复杂推理分解为可管理步骤的基本模板。

```md
# Step-by-Step Reasoning Template

Task: Solve the following problem by breaking it down into clear, logical steps.

Problem: {{problem}}

Please follow this process:
1. **Understand**: Restate the problem and identify what you need to find.
2. **Plan**: Outline your approach to solving the problem.
3. **Execute**: Work through each step of your plan in detail.
   - Step 1: [Description of the first step]
   - Step 2: [Description of the second step]
   - Step 3: [Continue with additional steps as needed]
4. **Verify**: Check your solution against the original problem.
5. **Conclude**: State your final answer or conclusion clearly.

Show all your work and explain your reasoning at each step.
```

**Token Count**: ~130 tokens (template only)  
**令牌数量** ：~130 个令牌（仅模板）

**Usage Example**:  
**使用示例** ：

- For mathematical problem solving  
    用于解决数学问题
- When working through complex logical arguments  
    在处理复杂的逻辑论证时
- For any task requiring transparent reasoning  
    对于任何需要透明推理的任务

### 2. Compare and Contrast  2. 比较和对比

[](https://github.com/KashiwaByte/Context-Engineering-Chinese-Bilingual/blob/main/Chinese-Bilingual/cognitive-tools/cognitive-templates/reasoning.md#2-compare-and-contrast)

For analytical reasoning that evaluates similarities and differences.  
用于评估相似性和差异性的分析推理。

```md
# Compare and Contrast Template

Task: Analyze the similarities and differences between the following items.

Items to Compare: {{item_a}} and {{item_b}}

Please follow this structured approach:
1. **Background**: Briefly introduce both items and their context.
2. **Criteria Selection**: Identify the key dimensions for comparison.
3. **Systematic Comparison**:
   - Dimension 1: [Explain how both items relate to this dimension]
   - Dimension 2: [Explain how both items relate to this dimension]
   - Dimension 3: [Continue with additional dimensions as needed]
4. **Key Similarities**: Explicitly list the most important similarities.
5. **Key Differences**: Explicitly list the most important differences.
6. **Synthesis**: Explain what these similarities and differences reveal.
7. **Conclusion**: Summarize the most significant insights from this comparison.
```

**Token Count**: ~140 tokens (template only)  
**令牌数量** ：~140 个令牌（仅模板）

**Usage Example**:  
**使用示例** ：

- For comparing theories, products, or approaches  
    用于比较理论、产品或方法
- When analyzing competing solutions  
    在分析竞争解决方案时
- For evaluating alternative explanations  
    用于评估其他解释

### 3. Causal Analysis  3.因果分析

[](https://github.com/KashiwaByte/Context-Engineering-Chinese-Bilingual/blob/main/Chinese-Bilingual/cognitive-tools/cognitive-templates/reasoning.md#3-causal-analysis)

For reasoning about cause and effect relationships.  
用于推理因果关系。

```md
# Causal Analysis Template

Task: Analyze the causes and effects related to the following situation or phenomenon.

Situation: {{situation}}

Please follow this structured approach:
1. **Describe the Phenomenon**: Clearly state what needs to be explained.
2. **Identify Potential Causes**:
   - Immediate Causes: [Direct factors that led to the situation]
   - Underlying Causes: [Deeper factors that created conditions for the situation]
   - Contributory Factors: [Elements that amplified or enabled the causes]
3. **Evaluate Each Cause**:
   - Evidence: [What evidence supports this as a cause?]
   - Significance: [How important was this cause?]
   - Mechanism: [How did this cause lead to the effect?]
4. **Analyze Effects**:
   - Immediate Effects: [Direct consequences]
   - Long-term Effects: [Ongoing or future consequences]
   - Secondary Effects: [Indirect consequences]
5. **Examine Interactions**: How do these causes and effects interact with each other?
6. **Conclusion**: Summarize the most significant causal relationships.
```

**Token Count**: ~160 tokens (template only)  
**令牌数量** ：~160 个令牌（仅模板）

**Usage Example**:  
**使用示例** ：

- For historical analysis  用于历史分析
- When investigating complex systems  
    在研究复杂系统时
- For understanding social or economic phenomena  
    用于理解社会或经济现象

## Advanced Templates  高级模板

[](https://github.com/KashiwaByte/Context-Engineering-Chinese-Bilingual/blob/main/Chinese-Bilingual/cognitive-tools/cognitive-templates/reasoning.md#advanced-templates)

### 4. Hypothesis Testing  4.假设检验

[](https://github.com/KashiwaByte/Context-Engineering-Chinese-Bilingual/blob/main/Chinese-Bilingual/cognitive-tools/cognitive-templates/reasoning.md#4-hypothesis-testing)

For systematically evaluating a hypothesis against evidence.  
用于系统地根据证据评估假设。

```md
# Hypothesis Testing Template

Task: Systematically evaluate the following hypothesis based on available evidence.

Hypothesis: {{hypothesis}}

Evidence: {{evidence}}

Please follow this structured approach:
1. **Clarify the Hypothesis**: Restate the hypothesis in precise terms.
2. **Identify Testable Predictions**: What should be true if the hypothesis is correct?
3. **Evaluate Evidence**:
   - Supporting Evidence: [Evidence that confirms predictions]
     - Strength: [How strongly does this evidence support the hypothesis?]
     - Reliability: [How reliable is this evidence?]
   - Contradictory Evidence: [Evidence that contradicts predictions]
     - Strength: [How strongly does this evidence oppose the hypothesis?]
     - Reliability: [How reliable is this evidence?]
   - Missing Evidence: [Evidence that should exist but isn't present]
4. **Consider Alternative Hypotheses**: What other explanations could account for the evidence?
5. **Weigh Comparative Explanatory Power**: How well does the hypothesis explain the evidence compared to alternatives?
6. **Conclusion**: Assess the overall credibility of the hypothesis.
7. **Confidence Level**: Indicate your level of confidence in this assessment.
```

**Token Count**: ~180 tokens (template only)  
**令牌数量** ：~180 个令牌（仅模板）

**Usage Example**:  
**使用示例** ：

- For scientific reasoning  
    为了科学推理
- When evaluating theories or claims  
    在评估理论或主张时
- For evidence-based decision making  
    基于证据的决策

### 5. Decision Matrix  5.决策矩阵

[](https://github.com/KashiwaByte/Context-Engineering-Chinese-Bilingual/blob/main/Chinese-Bilingual/cognitive-tools/cognitive-templates/reasoning.md#5-decision-matrix)

For structured decision making across multiple criteria.  
用于跨多个标准的结构化决策。

```md
# Decision Matrix Template

Task: Evaluate options against criteria to make a structured decision.

Decision Context: {{decision_context}}
Options: {{options}}
Criteria: {{criteria}}

Please follow this structured approach:
1. **Define the Decision**: Clearly state what decision needs to be made.
2. **Establish Criteria Weights**:
   - Criterion 1: [Importance weight (1-10)]
   - Criterion 2: [Importance weight (1-10)]
   - [Continue for all criteria]
3. **Evaluate Each Option**:
   Create a matrix with options as rows and criteria as columns.
   
   | Option | Criterion 1 | Criterion 2 | ... | Total |
   |--------|-------------|-------------|-----|-------|
   | Option A | [Score] | [Score] | ... | [Sum] |
   | Option B | [Score] | [Score] | ... | [Sum] |
   
   For each cell, provide:
   - Score: [Rating (1-10)]
   - Justification: [Brief explanation]
   
4. **Calculate Weighted Scores**: Multiply each score by the criterion weight.
5. **Rank Options**: Order options based on their total weighted scores.
6. **Sensitivity Analysis**: How would the ranking change if weights were adjusted?
7. **Recommendation**: State the recommended option with justification.
```

**Token Count**: ~180 tokens (template only)  
**令牌数量** ：~180 个令牌（仅模板）

**Usage Example**:  
**使用示例** ：

- For choosing between alternatives  
    用于选择替代方案
- When balancing multiple factors  
    当平衡多种因素时
- For transparent decision processes  
    为了透明的决策过程

### 6. Argument Construction  6.论证构建

[](https://github.com/KashiwaByte/Context-Engineering-Chinese-Bilingual/blob/main/Chinese-Bilingual/cognitive-tools/cognitive-templates/reasoning.md#6-argument-construction)

For building well-structured arguments.  
用于构建结构良好的论点。

```md
# Argument Construction Template

Task: Construct a well-reasoned argument for the following position.

Position: {{position}}

Please follow this structured approach:
1. **Thesis Statement**: Clearly articulate the main claim or position.
2. **Define Key Terms**: Clarify any ambiguous or technical terms.
3. **Establish Premises**:
   - Premise 1: [State first supporting claim]
     - Evidence: [Support for this premise]
     - Reasoning: [How this evidence supports the premise]
   - Premise 2: [State second supporting claim]
     - Evidence: [Support for this premise]
     - Reasoning: [How this evidence supports the premise]
   - [Continue with additional premises as needed]
4. **Logical Structure**: Explain how these premises lead to the conclusion.
5. **Address Counterarguments**:
   - Counterargument 1: [Potential objection]
     - Response: [Rebuttal or accommodation]
   - Counterargument 2: [Potential objection]
     - Response: [Rebuttal or accommodation]
6. **Conclusion**: Restate the thesis and summarize the supporting arguments.
```

**Token Count**: ~170 tokens (template only)  
**令牌数量** ：~170 个令牌（仅模板）

**Usage Example**:  
**使用示例** ：

- For persuasive writing  对于有说服力的写作
- When developing position papers  
    在制定立场文件时
- For constructing logical cases  
    用于构建逻辑案例

## Implementation Patterns  实现模式

[](https://github.com/KashiwaByte/Context-Engineering-Chinese-Bilingual/blob/main/Chinese-Bilingual/cognitive-tools/cognitive-templates/reasoning.md#implementation-patterns)

Here's a simple Python function to implement the Step-by-Step Reasoning template:  
这是一个简单的 Python 函数，用于实现逐步推理模板：

```python
def step_by_step_reasoning(problem, steps=None):
    """
    Create a prompt that guides through step-by-step reasoning.
    
    Args:
        problem (str): The problem to solve
        steps (list, optional): Custom steps for the reasoning process
        
    Returns:
        str: A formatted prompt for step-by-step reasoning
    """
    if steps is None:
        steps = [
            "Understand: Restate the problem and identify what you need to find.",
            "Plan: Outline your approach to solving the problem.",
            "Execute: Work through each step of your plan in detail.",
            "Verify: Check your solution against the original problem.",
            "Conclude: State your final answer or conclusion clearly."
        ]
    
    steps_text = "\n".join([f"{i+1}. **{step.split(':', 1)[0]}**:{step.split(':', 1)[1]}" 
                           for i, step in enumerate(steps)])
    
    return f"""
Task: Solve the following problem by breaking it down into clear, logical steps.

Problem: {problem}

Please follow this process:
{steps_text}

Show all your work and explain your reasoning at each step.
"""
```

## Measurement and Optimization  
测量与优化

[](https://github.com/KashiwaByte/Context-Engineering-Chinese-Bilingual/blob/main/Chinese-Bilingual/cognitive-tools/cognitive-templates/reasoning.md#measurement-and-optimization)

When using reasoning templates, measure their effectiveness by:  
使用推理模板时，通过以下方式衡量其有效性：

1. **Logical Validity**: Are the conclusions properly supported by the premises?  
    **逻辑有效性** ：结论是否得到前提的适当支持？
2. **Completeness**: Does the reasoning address all aspects of the problem?  
    **完整性** ：推理是否解决了问题的所有方面？
3. **Transparency**: Is each step clearly explained and justified?  
    **透明度** ：每个步骤是否都解释清楚并合理？
4. **Efficiency**: Does the reasoning take a direct path to the solution?  
    **效率** ：推理是否直接找到解决方案？
5. **Correctness**: Does the reasoning lead to the right answer or conclusion?  
    **正确性** ：推理是否得出正确的答案或结论？

Optimize your templates by:  
通过以下方式优化您的模板：

- Adjusting the level of detail based on problem complexity  
    根据问题复杂性调整细节级别
- Adding domain-specific reasoning steps for specialized fields  
    为专业领域添加特定领域的推理步骤
- Customizing evaluation criteria for particular types of problems  
    针对特定类型的问题定制评估标准

## Combining with Other Tools  
与其他工具结合

[](https://github.com/KashiwaByte/Context-Engineering-Chinese-Bilingual/blob/main/Chinese-Bilingual/cognitive-tools/cognitive-templates/reasoning.md#combining-with-other-tools)

Reasoning templates work best as part of a complete cognitive workflow:  
推理模板作为完整认知工作流程的一部分发挥最佳作用：

```
┌─────────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                     │     │                 │     │                 │
│ Understanding       │────►│ Reasoning       │────►│ Verification    │
│ Template            │     │ Template        │     │ Template        │
│                     │     │                 │     │                 │
└─────────────────────┘     └─────────────────┘     └─────────────────┘
```

For example, use an Understanding template to analyze a problem, apply a Reasoning template to solve it, and then use a Verification template to check the solution.  
例如，使用理解模板来分析问题，应用推理模板来解决问题，然后使用验证模板来检查解决方案。

## Advanced Reasoning Patterns  
高级推理模式

[](https://github.com/KashiwaByte/Context-Engineering-Chinese-Bilingual/blob/main/Chinese-Bilingual/cognitive-tools/cognitive-templates/reasoning.md#advanced-reasoning-patterns)

For complex problems, consider these advanced patterns:  
对于复杂的问题，请考虑以下高级模式：

### Divide and Conquer  分而治之

[](https://github.com/KashiwaByte/Context-Engineering-Chinese-Bilingual/blob/main/Chinese-Bilingual/cognitive-tools/cognitive-templates/reasoning.md#divide-and-conquer)

Break the problem into independent sub-problems, solve each separately, then combine the results.  
将问题分解为独立的子问题，分别解决每个子问题，然后合并结果。

```
┌───────────────────────────────────────────────────────────────┐
│                                                               │
│  Main Problem                                                 │
│       │                                                       │
│       ├────────────────┬────────────────┬────────────────┐    │
│       │                │                │                │    │
│       ▼                ▼                ▼                ▼    │
│  Sub-Problem 1    Sub-Problem 2    Sub-Problem 3    Sub-Problem 4 │
│       │                │                │                │    │
│       ├────────────────┼────────────────┼────────────────┘    │
│       │                │                │                     │
│       ▼                ▼                ▼                     │
│  Combine Solutions and Integrate Results                      │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

### Iterative Refinement  迭代细化

[](https://github.com/KashiwaByte/Context-Engineering-Chinese-Bilingual/blob/main/Chinese-Bilingual/cognitive-tools/cognitive-templates/reasoning.md#iterative-refinement)

Start with a simple solution, then iteratively improve it.  
从一个简单的解决方案开始，然后反复改进它。

```
┌───────────────────────────────────────────────────────────────┐
│                                                               │
│  Initial Solution                                             │
│       │                                                       │
│       ▼                                                       │
│  Identify Weaknesses                                          │
│       │                                                       │
│       ▼                                                       │
│  Improve Solution           ◄─────────────┐                   │
│       │                                    │                   │
│       ▼                                    │                   │
│  Evaluate Improvement                      │                   │
│       │                                    │                   │
│       └────────────────────────────────────┘                   │
│       │                                                        │
│       ▼                                                        │
│  Final Solution (when satisfactory)                            │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### Analogical Reasoning  类比推理

[](https://github.com/KashiwaByte/Context-Engineering-Chinese-Bilingual/blob/main/Chinese-Bilingual/cognitive-tools/cognitive-templates/reasoning.md#analogical-reasoning)

Apply reasoning patterns from a known domain to a new problem.  
将已知领域的推理模式应用于新问题。

```
┌───────────────────────────────────────────────────────────────┐
│                                                               │
│  Target Problem                                               │
│       │                                                       │
│       ▼                                                       │
│  Identify Similar Solved Problem                              │
│       │                                                       │
│       ▼                                                       │
│  Map Elements from Solved Problem to Target Problem           │
│       │                                                       │
│       ▼                                                       │
│  Apply Similar Solution Strategy                              │
│       │                                                       │
│       ▼                                                       │
│  Adapt as Needed for Target Problem                           │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

## Next Steps  后续步骤

[](https://github.com/KashiwaByte/Context-Engineering-Chinese-Bilingual/blob/main/Chinese-Bilingual/cognitive-tools/cognitive-templates/reasoning.md#next-steps)

- Explore [verification.md](https://github.com/KashiwaByte/Context-Engineering-Chinese-Bilingual/blob/main/Chinese-Bilingual/cognitive-tools/cognitive-templates/verification.md) for templates that check reasoning  
    探索 [verify.md](https://github.com/KashiwaByte/Context-Engineering-Chinese-Bilingual/blob/main/Chinese-Bilingual/cognitive-tools/cognitive-templates/verification.md) 以获取用于检查推理的模板
- See [composition.md](https://github.com/KashiwaByte/Context-Engineering-Chinese-Bilingual/blob/main/Chinese-Bilingual/cognitive-tools/cognitive-templates/composition.md) for ways to combine multiple templates  
    请参阅 [Composition.md](https://github.com/KashiwaByte/Context-Engineering-Chinese-Bilingual/blob/main/Chinese-Bilingual/cognitive-tools/cognitive-templates/composition.md) 了解组合多个模板的方法
- Check out [../cognitive-programs/advanced-programs.md](https://github.com/KashiwaByte/Context-Engineering-Chinese-Bilingual/blob/main/Chinese-Bilingual/cognitive-tools/cognitive-programs/advanced-programs.md) for programmatic approaches that leverage these reasoning patterns  
    请查看 [../cognitive-programs/advanced-programs.md](https://github.com/KashiwaByte/Context-Engineering-Chinese-Bilingual/blob/main/Chinese-Bilingual/cognitive-tools/cognitive-programs/advanced-programs.md) 了解利用这些推理模式的编程方法