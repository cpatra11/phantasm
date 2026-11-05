import { Editor } from '../../../components/Editor';

export default async function EditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ scene?: string }>;
}) {
  const { id } = await params;
  const { scene } = await searchParams;
  const initialScene = scene != null && Number.isInteger(Number(scene)) && Number(scene) >= 0 ? Number(scene) : undefined;
  return <Editor id={id} initialScene={initialScene} />;
}
