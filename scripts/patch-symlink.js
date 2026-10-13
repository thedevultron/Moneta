const fs = require('fs');
const path = require('path');

const origSymlink = fs.symlink;
const origSymlinkSync = fs.symlinkSync;

function isDirectory(target, dest) {
  try {
    if (fs.statSync(target).isDirectory()) return true;
  } catch {}
  try {
    if (dest) {
      const resolved = path.resolve(path.dirname(dest), target);
      if (fs.statSync(resolved).isDirectory()) return true;
    }
  } catch {}
  return false;
}

fs.symlink = function (target, dest, type, cb) {
  if (typeof type === 'function') {
    cb = type;
    type = undefined;
  }
  const isDir = type === 'dir' || type === 'junction' || isDirectory(target, dest);
  const winType = isDir ? 'junction' : (type || 'file');

  return origSymlink.call(fs, target, dest, winType, (err) => {
    if (err && (err.code === 'EPERM' || err.code === 'ENOSYS' || err.code === 'EEXIST')) {
      if (isDir) {
        origSymlink.call(fs, target, dest, 'junction', (err2) => {
          if (!err2) return cb ? cb(null) : undefined;
          fs.cp(target, dest, { recursive: true }, cb);
        });
        return;
      }
      return fs.copyFile(target, dest, cb);
    }
    if (cb) cb(err);
  });
};

fs.symlinkSync = function (target, dest, type) {
  const isDir = type === 'dir' || type === 'junction' || isDirectory(target, dest);
  const winType = isDir ? 'junction' : (type || 'file');

  try {
    return origSymlinkSync.call(fs, target, dest, winType);
  } catch (err) {
    if (err.code === 'EPERM' || err.code === 'ENOSYS' || err.code === 'EEXIST') {
      if (isDir) {
        try {
          return origSymlinkSync.call(fs, target, dest, 'junction');
        } catch {}
        return fs.cpSync(target, dest, { recursive: true });
      }
      return fs.copyFileSync(target, dest);
    }
    throw err;
  }
};

if (fs.promises && fs.promises.symlink) {
  const origPromisesSymlink = fs.promises.symlink;
  fs.promises.symlink = async function (target, dest, type) {
    const isDir = type === 'dir' || type === 'junction' || isDirectory(target, dest);
    const winType = isDir ? 'junction' : (type || 'file');

    try {
      return await origPromisesSymlink.call(fs.promises, target, dest, winType);
    } catch (err) {
      if (err.code === 'EPERM' || err.code === 'ENOSYS' || err.code === 'EEXIST') {
        if (isDir) {
          try {
            return await origPromisesSymlink.call(fs.promises, target, dest, 'junction');
          } catch {}
          return await fs.promises.cp(target, dest, { recursive: true });
        }
        return await fs.promises.copyFile(target, dest);
      }
      throw err;
    }
  };
}
