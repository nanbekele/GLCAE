import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

interface ContentBlock {
  id: string;
  title: string;
  description: string;
  published: boolean;
  slug: string;
}

const MarketingWebsiteContent = () => {
  const { toast } = useToast();
  const [blocks, setBlocks] = useState<ContentBlock[]>([
    {
      id: crypto.randomUUID(),
      title: 'About GCAE',
      description: 'Leading consulting engineers with multi-disciplinary expertise.',
      published: true,
      slug: 'about-overview',
    },
    {
      id: crypto.randomUUID(),
      title: 'Quality Promise',
      description: 'ISO-certified delivery and robust project governance ensure trust.',
      published: false,
      slug: 'quality-promise',
    },
  ]);

  const [editor, setEditor] = useState({
    id: '',
    title: '',
    description: '',
    published: false,
    slug: '',
  });

  const [isEditing, setIsEditing] = useState(false);

  const resetEditor = () => {
    setEditor({ id: '', title: '', description: '', published: false, slug: '' });
    setIsEditing(false);
  };

  const startEdit = (block: ContentBlock) => {
    setEditor(block);
    setIsEditing(true);
  };

  const saveBlock = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editor.title.trim() || !editor.description.trim() || !editor.slug.trim()) {
      toast({
        title: 'Missing information',
        description: 'Title, description, and slug are required.',
        variant: 'destructive',
      });
      return;
    }

    if (isEditing) {
      setBlocks(prev => prev.map(block => block.id === editor.id ? { ...editor, title: editor.title.trim(), description: editor.description.trim(), slug: editor.slug.trim() } : block));
      toast({ title: 'Content updated', description: `${editor.title} saved successfully.` });
    } else {
      const newBlock: ContentBlock = {
        id: crypto.randomUUID(),
        title: editor.title.trim(),
        description: editor.description.trim(),
        slug: editor.slug.trim(),
        published: editor.published,
      };
      setBlocks(prev => [newBlock, ...prev]);
      toast({ title: 'Content created', description: `${editor.title} added to website queue.` });
    }

    resetEditor();
  };

  const togglePublish = (id: string) => {
    setBlocks(prev => prev.map(block => block.id === id ? { ...block, published: !block.published } : block));
  };

  const removeBlock = (id: string) => {
    setBlocks(prev => prev.filter(block => block.id !== id));
    toast({ title: 'Content removed', description: 'Section removed from marketing staging area.' });
    if (editor.id === id) {
      resetEditor();
    }
  };

  return (
    <div className="min-h-screen bg-muted/30 p-6">
      <div className="max-w-6xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Website Content</h1>
          <p className="text-muted-foreground max-w-2xl">
            Update hero copy, about pages and value propositions before submitting to the web team. All
            edits stay local until marketing publishes them.
          </p>
        </div>

        <Card className="shadow-corporate border-card-border">
          <CardHeader>
            <CardTitle>{isEditing ? 'Edit Content Block' : 'Create Content Block'}</CardTitle>
            <CardDescription>These blocks populate the public About and Services sections.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={saveBlock}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    placeholder="eg. Our Mission"
                    value={editor.title}
                    onChange={(event) => setEditor(prev => ({ ...prev, title: event.target.value }))}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="slug">Slug</Label>
                  <Input
                    id="slug"
                    placeholder="about/mission"
                    value={editor.slug}
                    onChange={(event) => setEditor(prev => ({ ...prev, slug: event.target.value }))}
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="description">Body Copy</Label>
                <Textarea
                  id="description"
                  rows={5}
                  placeholder="Draft the copy that will appear on the page."
                  value={editor.description}
                  onChange={(event) => setEditor(prev => ({ ...prev, description: event.target.value }))}
                  required
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="published"
                  checked={editor.published}
                  onCheckedChange={(checked) => setEditor(prev => ({ ...prev, published: checked }))}
                />
                <Label htmlFor="published">Mark as ready for publishing</Label>
              </div>

              <div className="flex gap-2 justify-end">
                {isEditing && (
                  <Button type="button" variant="outline" onClick={resetEditor}>
                    Cancel
                  </Button>
                )}
                <Button type="submit">{isEditing ? 'Save Changes' : 'Add Block'}</Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="shadow-corporate border-card-border">
          <CardHeader>
            <CardTitle>Content Library</CardTitle>
            <CardDescription>Use this staging area to coordinate copy between teams.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {blocks.length === 0 && (
                <p className="text-sm text-muted-foreground">No content blocks yet. Create your first entry above.</p>
              )}
              {blocks.map(block => (
                <div key={block.id} className="border border-border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <h3 className="text-lg font-semibold text-foreground">{block.title}</h3>
                      <Badge variant={block.published ? 'default' : 'secondary'}>
                        {block.published ? 'Ready to publish' : 'Draft'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => togglePublish(block.id)}>
                        {block.published ? 'Move to Draft' : 'Mark Ready'}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => startEdit(block)}>
                        Edit
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => removeBlock(block.id)}>
                        Delete
                      </Button>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{block.description}</p>
                  <p className="text-xs text-muted-foreground">Slug: {block.slug}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default MarketingWebsiteContent;
