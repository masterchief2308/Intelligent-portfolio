import { Node, Edge, Position } from '@xyflow/react';

const createNode = (id: string, x: number, y: number, label: string, isProject: boolean = false): Node => ({
  id,
  type: 'custom',
  position: { x, y },
  data: { label, isProject },
  sourcePosition: Position.Right,
  targetPosition: Position.Left,
});

const createEdge = (
  source: string,
  target: string,
  animated: boolean = true,
  dash: boolean = false,
  label?: string,
  sourceHandle?: string,
  targetHandle?: string
): Edge => ({
  id: `e-${source}-${sourceHandle || 'r'}-${target}-${targetHandle || 'l'}`,
  source,
  target,
  ...(sourceHandle && { sourceHandle }),
  ...(targetHandle && { targetHandle }),
  animated,
  type: 'smoothstep',
  ...(label && { label }),
  style: {
    stroke: dash ? 'rgba(255,255,255,0.2)' : 'rgba(251,191,36,0.3)',
    strokeWidth: dash ? 1 : 2,
    strokeDasharray: dash ? '5,5' : 'none'
  }
});

const createGroupNode = (id: string, x: number, y: number, width: number, height: number, label: string, badge: string, parentId?: string): Node => ({
  id,
  type: 'group',
  position: { x, y },
  style: { width, height },
  data: { label, badge },
  ...(parentId && { parentId }),
});

const createChildNode = (id: string, x: number, y: number, label: string, badge: string, parentId: string): Node => ({
  id,
  type: 'custom',
  position: { x, y },
  data: { label, badge },
  parentId,
  extent: 'parent',
  sourcePosition: Position.Right,
  targetPosition: Position.Left,
});

export const getProjectArchitecture = (slug: string): { nodes: Node[], edges: Edge[] } | null => {
  if (slug === 'iocl-tender-evaluation') {
    return {
      nodes: [
        createNode('plugin', -300, -50, 'GeM Portal Plugin', true),
        createNode('user', -300, 200, 'IOCL User', true),

        createGroupNode('gcp', 0, -150, 1200, 1000, 'Google Cloud Platform', 'GCP'),

        createChildNode('frontend', 50, 350, 'React Frontend', 'RUN', 'gcp'),
        createChildNode('cloudrun', 780, 100, 'Cloud Run (Download Job)', 'RUN', 'gcp'),

        createChildNode('secrets', 980, 250, 'Secret Manager', 'SEC', 'gcp'),
        createChildNode('bucket', 980, 400, 'Cloud Storage (Zip)', 'GCS', 'gcp'),
        createChildNode('firestore', 980, 700, 'Firestore (Tender DB)', 'DB', 'gcp'),

        createGroupNode('gke', 300, 200, 450, 750, 'Google Kubernetes Engine', 'GKE', 'gcp'),

        createChildNode('backend', 50, 50, 'FastAPI Backend', 'API', 'gke'),
        createChildNode('ocr', 50, 200, 'OCR Celery Pod [Qwen2-VL]', 'POD', 'gke'),
        createChildNode('segment', 50, 350, 'Segment Celery Pod [Llama 4 Scout]', 'POD', 'gke'),
        createChildNode('extract', 50, 500, 'Extract Celery Pod [Qwen 32B]', 'POD', 'gke'),
        createChildNode('l1', 50, 650, 'L1: Low Token', 'LLM', 'gke'),
        createChildNode('l2', 250, 650, 'L2: Detailed (Low Conf)', 'LLM', 'gke')
      ],
      edges: [
        createEdge('user', 'plugin'),
        createEdge('user', 'frontend'),
        createEdge('plugin', 'backend', false, true, 'Version Check'),
        createEdge('plugin', 'cloudrun', true, false, 'Trigger Download'),
        createEdge('frontend', 'backend'),
        createEdge('cloudrun', 'backend', false, true),

        createEdge('backend', 'ocr', false, true, 'Pub/Sub', 's-bottom', 't-top'),
        createEdge('ocr', 'segment', false, true, 'Pub/Sub', 's-bottom', 't-top'),
        createEdge('segment', 'extract', false, true, 'Pub/Sub', 's-bottom', 't-top'),
        createEdge('extract', 'l1', true, false, undefined, 's-bottom', 't-top'),
        createEdge('extract', 'l2', true, true),

        createEdge('l1', 'firestore', false, true, undefined, undefined, 't-top'),
        createEdge('l2', 'firestore', false, true),

        createEdge('backend', 'secrets', false, true),
        createEdge('ocr', 'secrets', false, true),
        createEdge('extract', 'secrets', false, true),

        createEdge('cloudrun', 'bucket', false, false, undefined, 's-bottom', 't-top'),
        createEdge('cloudrun', 'firestore', false, false, undefined, 's-bottom', 't-top'),
        createEdge('backend', 'firestore', false, true),
        createEdge('backend', 'bucket', false, true),
        createEdge('ocr', 'bucket', false, true),
        createEdge('segment', 'bucket', false, true),
        createEdge('extract', 'firestore', false, true)
      ]
    };
  }

  if (slug === 'km-tech-int-forensics') {
    return {
      nodes: [
        createNode('frontend', -150, 150, 'React TS Frontend', true),

        createGroupNode('gcp', 200, 0, 700, 500, 'Google Cloud Platform', 'GCP'),

        createChildNode('api', 50, 150, 'Backend API', 'API', 'gcp'),
        createChildNode('redis', 350, 50, 'Redis Cache', 'CACHE', 'gcp'),
        createChildNode('bucket', 350, 150, 'GCP Bucket', 'GCS', 'gcp'),
        createChildNode('database', 350, 300, 'Database (Neo4j/Postgres)', 'DB', 'gcp'),
        createChildNode('gemini', 350, 400, 'Gemini 2.5 Flash API', 'AI', 'gcp')
      ],
      edges: [
        createEdge('frontend', 'api'),
        createEdge('api', 'redis'),
        createEdge('api', 'bucket'),
        createEdge('api', 'database'),
        createEdge('api', 'gemini', false, true, 'API Key')
      ]
    };
  }

  if (slug === 'azolla-casper') {
    return {
      nodes: [
        createNode('sources', -300, 150, 'Raw Data (Fuel, AIS, Registry)', true),

        createGroupNode('aws', 0, 0, 1000, 450, 'Amazon Web Services', 'AWS'),

        createChildNode('layer1', 50, 150, 'L1: Data Cleaning', 'DATA', 'aws'),
        createChildNode('layer2', 300, 150, 'L2: Feature Engineering (Scikit)', 'ML', 'aws'),
        createChildNode('layer3', 550, 150, 'L3: ML Regressor (RandomForest)', 'ML', 'aws'),

        createChildNode('layer4a', 850, 0, 'L4a: Penalty Calculator (€100/tonne)', 'CALC', 'aws'),
        createChildNode('layer4b', 850, 300, 'L4b: Pool Dive (Vessel Matching)', 'MATCH', 'aws'),

        createChildNode('celery', 550, -100, 'Celery Background Alerts', 'WORKER', 'aws'),
        createChildNode('ses', 850, -100, 'AWS SES', 'EMAIL', 'aws'),

        createNode('expert', 1200, 150, 'L5: Domain Expert Validation (SHAP)', true)
      ],
      edges: [
        createEdge('sources', 'layer1'),
        createEdge('layer1', 'layer2'),
        createEdge('layer2', 'layer3'),
        createEdge('layer3', 'layer4a'),
        createEdge('layer3', 'layer4b'),
        createEdge('layer4a', 'celery', false, true),
        createEdge('celery', 'ses'),
        createEdge('layer3', 'expert', false, true)
      ]
    };
  }

  return null;
};
