import { useState } from 'react';

function TreeNode({ node, depth, activeFile, onFileClick }) {
  const [expanded, setExpanded] = useState(depth < 1);
  const indent = 8 + depth * 12;

  if (node.type === 'dir') {
    return (
      <div>
        <div
          className="tree-item"
          style={{ paddingLeft: indent }}
          onClick={() => setExpanded((e) => !e)}
        >
          <span className="tree-chevron">{expanded ? '▾' : '▸'}</span>
          <span className="tree-name tree-dir">{node.name}</span>
        </div>
        {expanded &&
          node.children?.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              activeFile={activeFile}
              onFileClick={onFileClick}
            />
          ))}
      </div>
    );
  }

  return (
    <div
      className={`tree-item${activeFile === node.path ? ' active' : ''}`}
      style={{ paddingLeft: indent + 14 }}
      onClick={() => onFileClick(node.path, node.name)}
    >
      <span className="tree-name">{node.name}</span>
    </div>
  );
}

export function FileTree({ tree, activeFile, onFileClick }) {
  if (!tree || !tree.length) {
    return <div className="sidebar-empty">Loading…</div>;
  }
  return (
    <div className="file-tree">
      {tree.map((node) => (
        <TreeNode
          key={node.path}
          node={node}
          depth={0}
          activeFile={activeFile}
          onFileClick={onFileClick}
        />
      ))}
    </div>
  );
}
