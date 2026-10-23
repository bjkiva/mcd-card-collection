"""Export an upload snapshot without the nested Sites Git repository or runtime data."""
from pathlib import Path
from datetime import datetime
import json
import re
import shutil
import zipfile

root = Path(__file__).resolve().parent.parent
release = root / 'release'
suffix = datetime.now().strftime('%Y%m%d-%H%M%S')
destination = release / ('github-upload-' + suffix)
archive = release / ('mcd-card-collection-' + suffix + '.zip')
if destination.exists() or archive.exists():
    raise SystemExit('Snapshot already exists; run again later to create a new snapshot.')

top_files = ['.gitignore', 'package.json', 'README.md', 'SKILL.md',
             'CONTEST_DECLARATION.md', 'MCP_INTEGRATION.md',
             'mcp-config.example.json', 'workbuddy.md', 'WORKBUDDY_PROMPT.md']
sources = [root / name for name in top_files]
sources += [root / 'site' / name for name in ['.gitignore', 'package.json', 'README.md', 'server.mjs', '.openai/hosting.json']]
for directory, extensions in [('site/public', {'.html', '.css', '.js', '.png'}),
                              ('site/src', {'.js'}), ('site/tests', {'.js'}),
                              ('site/scripts', {'.mjs', '.sh'}),
                              ('site/worker', {'.js'}), ('scripts', {'.py'}),
                              ('docs', {'.md', '.png'})]:
    sources += [p for p in (root / directory).rglob('*') if p.is_file() and p.suffix in extensions]

sources = sorted(set(sources))
credential_pattern = re.compile(r'(?:sk-[A-Za-z0-9_-]{24,}|art_v2_[A-Za-z0-9_-]{24,}|Bearer [A-Za-z0-9._-]{30,})')
for source in sources:
    if source.is_symlink() or not source.resolve().is_relative_to(root):
        raise SystemExit('Refusing a source path outside the workspace.')
    if not source.is_file():
        raise SystemExit('Required source missing: ' + str(source.relative_to(root)))
    if source.suffix not in {'.png'} and credential_pattern.search(source.read_text(encoding='utf-8')):
        raise SystemExit('Credential-like literal found; inspect locally: ' + str(source.relative_to(root)))

destination.mkdir(parents=True)
for source in sources:
    target = destination / source.relative_to(root)
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, target)

partial_archive = archive.with_suffix('.zip.part')
with zipfile.ZipFile(partial_archive, 'x', zipfile.ZIP_DEFLATED, strict_timestamps=False) as zipped:
    for source in sources:
        relative = source.relative_to(root)
        zipped.write(destination / relative, str(Path('mcd-card-collection') / relative))
partial_archive.replace(archive)

print(json.dumps({'directory': str(destination), 'archive': str(archive),
                  'files': len(sources), 'nested_git_excluded': True}, ensure_ascii=False))
