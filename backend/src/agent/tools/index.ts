import type { AgentTool, AgentToolCall } from '../../types/agent.types.js';
import type { TutorSource } from '../../types/tutor.types.js';
import type { ChartSpec } from '../../utils/chart.js';
import { searchCourseMaterialTool, executeSearchCourseMaterial } from './searchCourseMaterial.tool.js';
import { getLessonTool, executeGetLesson } from './getLesson.tool.js';
import { askStudentTool } from './askStudent.tool.js';
import { generateChartTool, executeGenerateChart } from './generateChart.tool.js';

export interface ToolContext {
  courseId: string;
  /** The course's selected RAG source (Course.knowledgeBaseDocumentId),
   * resolved once by the orchestrator — null when the teacher hasn't chosen
   * one. search_course_material is scoped to this document, never to every
   * document the course happens to have uploaded. */
  knowledgeBaseDocumentId: string | null;
}

export interface ToolExecutionResult {
  content: string;
  sources: TutorSource[] | null;
  chart?: ChartSpec;
}

// The full tool list handed to runAgentTurn. ask_student is included here
// (the model must see it as an available tool) but has no entry in
// TOOL_HANDLERS below — the orchestrator intercepts it by name before
// reaching the generic execution path, per its "control-flow only" rule.
export const AGENT_TOOLS: AgentTool[] = [
  searchCourseMaterialTool,
  getLessonTool,
  askStudentTool,
  generateChartTool,
];

export const TOOL_HANDLERS: Record<
  string,
  (rawArgs: string, ctx: ToolContext) => Promise<ToolExecutionResult>
> = {
  search_course_material: executeSearchCourseMaterial,
  get_lesson: executeGetLesson,
  generate_chart: executeGenerateChart,
};

export type { AgentToolCall };
