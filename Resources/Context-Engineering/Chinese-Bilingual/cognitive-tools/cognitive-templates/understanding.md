# Understanding Templates  了解模板

[](https://github.com/KashiwaByte/Context-Engineering-Chinese-Bilingual/blob/main/Chinese-Bilingual/cognitive-tools/cognitive-templates/understanding.md#understanding-templates)

> "The beginning of wisdom is the definition of terms." — Socrates  
> “智慧的开端是术语的定义。”——苏格拉底

## Overview  概述

[](https://github.com/KashiwaByte/Context-Engineering-Chinese-Bilingual/blob/main/Chinese-Bilingual/cognitive-tools/cognitive-templates/understanding.md#overview)

Understanding templates help language models comprehend and analyze information before attempting to solve a problem or generate content. These templates serve as the foundation for effective reasoning by ensuring the model has properly interpreted the task, context, and requirements.  
理解模板有助于语言模型在尝试解决问题或生成内容之前理解和分析信息。这些模板可确保模型正确解读任务、上下文和需求，从而为有效推理奠定基础。

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│  UNDERSTANDING PROCESS                                       │
│                                                              │
│  Input → Analyze → Structure → Clarify → Ready for Reasoning │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

## Basic Templates  基本模板

[](https://github.com/KashiwaByte/Context-Engineering-Chinese-Bilingual/blob/main/Chinese-Bilingual/cognitive-tools/cognitive-templates/understanding.md#basic-templates)

### 1. Question Analysis  1. 问题分析

[](https://github.com/KashiwaByte/Context-Engineering-Chinese-Bilingual/blob/main/Chinese-Bilingual/cognitive-tools/cognitive-templates/understanding.md#1-question-analysis)

The most fundamental understanding template helps break down a question or problem into its core components.  
最基本的理解模板有助于将问题分解为其核心组成部分。

```md
# Question Analysis Template

Task: Analyze and break down the following question before attempting to answer it.

Question: {{question}}

Please provide:
1. **Question Type**: What kind of question is this? (e.g., factual, conceptual, analytical)
2. **Core Task**: What specific action or thinking is required?
3. **Key Components**: What are the main elements that need to be addressed?
4. **Implicit Assumptions**: What unstated assumptions might be relevant?
5. **Knowledge Domains**: What fields of knowledge are relevant?
6. **Constraints**: Are there any explicit or implicit constraints?
7. **Restatement**: Restate the question in your own words for clarity.

Once you've completed this analysis, you'll be better prepared to address the question effectively.
```

**Token Count**: ~120 tokens (template only)  
**令牌数量** ：~120 个令牌（仅模板）

**Usage Example**:  
**使用示例** ：

- For complex questions where understanding the requirements is crucial  
    对于复杂的问题，理解要求至关重要
- When precision in interpretation matters  
    当解释的精确度很重要时
- Before tackling multi-step problems  
    在解决多步骤问题之前

### 2. Information Extraction  
2.信息提取

[](https://github.com/KashiwaByte/Context-Engineering-Chinese-Bilingual/blob/main/Chinese-Bilingual/cognitive-tools/cognitive-templates/understanding.md#2-information-extraction)

For extracting structured information from text.  
用于从文本中提取结构化信息。

```md
# Information Extraction Template

Task: Extract and organize the key information from the following text.

Text: {{text}}

Please extract:
1. **Main Topic**: What is the central subject?
2. **Key Facts**: List the most important factual statements.
3. **Entities**: Identify people, organizations, locations, dates, etc.
4. **Relationships**: How are these entities related to each other?
5. **Numerical Data**: Extract any numbers, statistics, or measurements.
6. **Claims**: What assertions or arguments are made?
7. **Evidence**: What support is provided for these claims?

Organize this information in a clear, structured format.
```

**Token Count**: ~110 tokens (template only)  
**令牌数量** ：~110 个令牌（仅模板）

**Usage Example**:  
**使用示例** ：

- For processing research papers or articles  
    用于处理研究论文或文章
- When summarizing complex documents  
    总结复杂文档时
- Before synthesizing information from multiple sources  
    在综合来自多个来源的信息之前

### 3. Problem Decomposition  3.问题分解

[](https://github.com/KashiwaByte/Context-Engineering-Chinese-Bilingual/blob/main/Chinese-Bilingual/cognitive-tools/cognitive-templates/understanding.md#3-problem-decomposition)

For breaking down complex problems into solvable parts.  
将复杂问题分解为可解决的部分。

```md
# Problem Decomposition Template

Task: Decompose the following problem into smaller, manageable components.

Problem: {{problem}}

Please provide:
1. **Problem Type**: What category of problem is this?
2. **Goal State**: What does a successful solution look like?
3. **Given Information**: What information is explicitly provided?
4. **Unknown Variables**: What needs to be determined?
5. **Constraints**: What limitations or conditions must be satisfied?
6. **Sub-Problems**: Break down the main problem into smaller parts.
7. **Dependencies**: How do these sub-problems relate to each other?
8. **Solution Approach**: Suggest a high-level strategy for solving the problem.

This decomposition will provide a structured approach to solving the problem.
```

**Token Count**: ~120 tokens (template only)  
**令牌数量** ：~120 个令牌（仅模板）

**Usage Example**:  
**使用示例** ：

- For mathematical or logical problems  
    对于数学或逻辑问题
- When faced with multi-step reasoning tasks  
    当面临多步骤推理任务时
- Before attempting complex analyses  
    在尝试进行复杂分析之前

## Advanced Templates  高级模板

[](https://github.com/KashiwaByte/Context-Engineering-Chinese-Bilingual/blob/main/Chinese-Bilingual/cognitive-tools/cognitive-templates/understanding.md#advanced-templates)

### 4. Conceptual Mapping  4.概念图

[](https://github.com/KashiwaByte/Context-Engineering-Chinese-Bilingual/blob/main/Chinese-Bilingual/cognitive-tools/cognitive-templates/understanding.md#4-conceptual-mapping)

For understanding relationships between concepts within a domain.  
用于理解领域内概念之间的关系。

```md
# Conceptual Mapping Template

Task: Create a conceptual map of the ideas and relationships in the following text.

Text: {{text}}

Please provide:
1. **Core Concepts**: Identify the central ideas or concepts.
2. **Concept Definitions**: Briefly define each concept.
3. **Hierarchical Relationships**: Which concepts are subcategories of others?
4. **Causal Relationships**: Which concepts influence or cause others?
5. **Contrasting Concepts**: Which concepts stand in opposition to each other?
6. **Complementary Concepts**: Which concepts support or enhance each other?
7. **Missing Concepts**: Are there any implied but unstated concepts?

Represent these relationships in a structured format that shows how the concepts interconnect.
```

**Token Count**: ~120 tokens (template only)  
**令牌数量** ：~120 个令牌（仅模板）

**Usage Example**:  
**使用示例** ：

- For theoretical or abstract content  
    对于理论或抽象内容
- When analyzing complex systems  
    分析复杂系统时
- Before synthesizing disparate information  
    在整合不同的信息之前

### 5. Multi-Perspective Analysis  
5.多视角分析

[](https://github.com/KashiwaByte/Context-Engineering-Chinese-Bilingual/blob/main/Chinese-Bilingual/cognitive-tools/cognitive-templates/understanding.md#5-multi-perspective-analysis)

For understanding different viewpoints on a topic.  
为了了解某个主题的不同观点。

```md
# Multi-Perspective Analysis Template

Task: Analyze the following topic from multiple perspectives.

Topic: {{topic}}

Please provide:
1. **Perspective Identification**: What major viewpoints exist on this topic?
2. **Core Arguments**: What are the main arguments from each perspective?
3. **Evidence Base**: What evidence supports each perspective?
4. **Underlying Values**: What values or assumptions underlie each perspective?
5. **Areas of Agreement**: Where do the perspectives converge?
6. **Key Disagreements**: What are the fundamental points of contention?
7. **Synthesis Possibilities**: How might these perspectives be integrated?

This analysis will provide a balanced understanding of the different ways to view this topic.
```

**Token Count**: ~120 tokens (template only)  
**令牌数量** ：~120 个令牌（仅模板）

**Usage Example**:  
**使用示例** ：

- For controversial or complex topics  
    对于有争议或复杂的话题
- When balanced understanding is crucial  
    当平衡理解至关重要时
- Before forming a nuanced position  
    在形成微妙的立场之前

### 6. Requirement Analysis  6.需求分析

[](https://github.com/KashiwaByte/Context-Engineering-Chinese-Bilingual/blob/main/Chinese-Bilingual/cognitive-tools/cognitive-templates/understanding.md#6-requirement-analysis)

For clearly understanding task requirements.  
为了清楚地了解任务要求。

```md
# Requirement Analysis Template

Task: Analyze the requirements for the following task or project.

Task Description: {{task_description}}

Please provide:
1. **Primary Objective**: What is the main goal?
2. **Deliverables**: What specific outputs are required?
3. **Quality Criteria**: How will success be measured?
4. **Constraints**: What limitations must be worked within?
5. **Dependencies**: What external factors impact this task?
6. **Stakeholders**: Who is involved or affected?
7. **Priorities**: Which aspects are most important?
8. **Ambiguities**: What aspects need clarification?

This analysis will ensure all requirements are properly understood before proceeding.
```

**Token Count**: ~120 tokens (template only)  
**令牌数量** ：~120 个令牌（仅模板）

**Usage Example**:  
**使用示例** ：

- For project planning  对于项目规划
- When tasked with creating specific outputs  
    当需要创建特定输出时
- Before beginning any complex task  
    在开始任何复杂任务之前

## Implementation Patterns  实现模式

[](https://github.com/KashiwaByte/Context-Engineering-Chinese-Bilingual/blob/main/Chinese-Bilingual/cognitive-tools/cognitive-templates/understanding.md#implementation-patterns)

Here's a simple Python function to implement the Question Analysis template:  
下面是一个用于实现问题分析模板的简单 Python 函数：

```python
def understand_question(question):
    """
    Create a prompt that analyzes and breaks down a question.
    
    Args:
        question (str): The question to analyze
        
    Returns:
        str: A formatted prompt for question analysis
    """
    return f"""
Task: Analyze and break down the following question before attempting to answer it.

Question: {question}

Please provide:
1. **Question Type**: What kind of question is this? (e.g., factual, conceptual, analytical)
2. **Core Task**: What specific action or thinking is required?
3. **Key Components**: What are the main elements that need to be addressed?
4. **Implicit Assumptions**: What unstated assumptions might be relevant?
5. **Knowledge Domains**: What fields of knowledge are relevant?
6. **Constraints**: Are there any explicit or implicit constraints?
7. **Restatement**: Restate the question in your own words for clarity.

Once you've completed this analysis, you'll be better prepared to address the question effectively.
"""
```

## Measurement and Optimization  
测量与优化

[](https://github.com/KashiwaByte/Context-Engineering-Chinese-Bilingual/blob/main/Chinese-Bilingual/cognitive-tools/cognitive-templates/understanding.md#measurement-and-optimization)

When using understanding templates, measure their effectiveness by:  
使用理解模板时，通过以下方式衡量其有效性：

1. **Accuracy**: Does the understanding correctly identify all key elements?  
    **准确性** ：理解是否正确识别了所有关键要素？
2. **Comprehensiveness**: Are all important aspects of the input covered?  
    **全面性** ：是否涵盖了输入的所有重要方面？
3. **Clarity**: Is the structured understanding clear and unambiguous?  
    **清晰度** ：结构化的理解是否清晰明确？
4. **Utility**: Does the understanding improve subsequent reasoning?  
    **实用性** ：这种理解是否会改善后续的推理？

Optimize your templates by:  
通过以下方式优化您的模板：

- Removing unnecessary components that don't improve understanding  
    删除那些无法提高理解力的不必要的组件
- Adding specific components needed for your particular domain  
    添加特定域所需的特定组件
- Adjusting the level of detail based on the complexity of your inputs  
    根据输入的复杂程度调整细节级别

## Combining with Other Tools  
与其他工具结合

[](https://github.com/KashiwaByte/Context-Engineering-Chinese-Bilingual/blob/main/Chinese-Bilingual/cognitive-tools/cognitive-templates/understanding.md#combining-with-other-tools)

Understanding templates work best when combined with other cognitive tools:  
理解模板与其他认知工具结合使用时效果最佳：

```
┌─────────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                     │     │                 │     │                 │
│ Understanding       │────►│ Reasoning       │────►│ Verification    │
│ Template            │     │ Template        │     │ Template        │
│                     │     │                 │     │                 │
└─────────────────────┘     └─────────────────┘     └─────────────────┘
```

For example, use the Question Analysis template first, then pass the structured understanding to a problem-solving template, and finally verify the solution with a verification template.  
例如，先使用问题分析模板，然后将结构化的理解传递给问题解决模板，最后用验证模板验证解决方案。

## Next Steps  后续步骤

[](https://github.com/KashiwaByte/Context-Engineering-Chinese-Bilingual/blob/main/Chinese-Bilingual/cognitive-tools/cognitive-templates/understanding.md#next-steps)

- Explore [reasoning.md](https://github.com/KashiwaByte/Context-Engineering-Chinese-Bilingual/blob/main/Chinese-Bilingual/cognitive-tools/cognitive-templates/reasoning.md) for templates that build on understanding  
    探索 [reasoning.md](https://github.com/KashiwaByte/Context-Engineering-Chinese-Bilingual/blob/main/Chinese-Bilingual/cognitive-tools/cognitive-templates/reasoning.md) 以获取基于理解的模板
- See [composition.md](https://github.com/KashiwaByte/Context-Engineering-Chinese-Bilingual/blob/main/Chinese-Bilingual/cognitive-tools/cognitive-templates/composition.md) for ways to combine multiple templates  
    请参阅 [Composition.md](https://github.com/KashiwaByte/Context-Engineering-Chinese-Bilingual/blob/main/Chinese-Bilingual/cognitive-tools/cognitive-templates/composition.md) 了解组合多个模板的方法
- Check out [../cognitive-programs/basic-programs.md](https://github.com/KashiwaByte/Context-Engineering-Chinese-Bilingual/blob/main/Chinese-Bilingual/cognitive-tools/cognitive-programs/basic-programs.md) for programmatic approaches that use these templates  
    查看 [../cognitive-programs/basic-programs.md](https://github.com/KashiwaByte/Context-Engineering-Chinese-Bilingual/blob/main/Chinese-Bilingual/cognitive-tools/cognitive-programs/basic-programs.md) 了解使用这些模板的编程方法