'use strict';

/**
 * In-memory todo store. Deliberately dependency-free: the point of this
 * repository is to be a small, reliable tenant for the deployment platform,
 * not to ship a database.
 */
function createTodoStore(seed = []) {
  const todos = new Map();
  let nextId = 1;

  function create(title) {
    const now = new Date().toISOString();
    const todo = {
      id: nextId++,
      title,
      completed: false,
      createdAt: now,
      updatedAt: now,
    };
    todos.set(todo.id, todo);
    return todo;
  }

  function get(id) {
    return todos.get(id) ?? null;
  }

  function list() {
    return [...todos.values()].sort((a, b) => a.id - b.id);
  }

  function update(id, patch) {
    const todo = todos.get(id);
    if (!todo) return null;

    if (patch.title !== undefined) todo.title = patch.title;
    if (patch.completed !== undefined) todo.completed = patch.completed;
    todo.updatedAt = new Date().toISOString();

    return todo;
  }

  function remove(id) {
    return todos.delete(id);
  }

  function clear() {
    todos.clear();
    nextId = 1;
  }

  for (const item of seed) {
    create(item);
  }

  return {
    create,
    get,
    list,
    update,
    remove,
    clear,
    get size() {
      return todos.size;
    },
  };
}

module.exports = { createTodoStore };
