export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM';

export interface BottleneckItem {
  id: string;
  subsystem: string;
  title: string;
  severity: Severity;
  filePath: string;
  lineNumbers: string;
  summary: string;
  rootCause: string;
  runtimeImpact: string;
  resourceWaste: string;
  concurrencyRisk: string;
  latencyPenalty: string;
  originalCodeSnippet: string;
  optimizedCodeSnippet: string;
  optimizationSummary: string;
  architectureFix: string;
  benchmarkBefore: string;
  benchmarkAfter: string;
  speedupMultiplier: string;
}

export interface SubsystemStats {
  name: string;
  category: string;
  criticalIssues: number;
  highIssues: number;
  mediumIssues: number;
  estLatencyReduction: string;
  estCpuReduction: string;
}

export interface BenchmarkScenario {
  id: string;
  title: string;
  subsystem: string;
  workloadDescription: string;
  metricName: string;
  unit: string;
  baselineValue: number;
  optimizedValue: number;
  speedup: string;
  memoryBaselineMb: number;
  memoryOptimizedMb: number;
  cpuBaselinePct: number;
  cpuOptimizedPct: number;
  explanation: string;
}

export interface ArchitectureRecommendation {
  id: string;
  tier: 'KERNEL_TIER' | 'ROUTING_TIER' | 'EXECUTION_TIER' | 'DISCOVERY_TIER';
  title: string;
  targetSubsystems: string[];
  currentPattern: string;
  recommendedPattern: string;
  benefits: string[];
  riskLevel: 'LOW' | 'MEDIUM';
  implementationEffort: 'LOW' | 'MEDIUM' | 'HIGH';
}
