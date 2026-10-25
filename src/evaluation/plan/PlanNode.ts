import { type RowView } from "../../relational/RowView.js";

export interface PlanNode {
  execute(): IterableIterator<RowView>;
}

// export interface PlanNode<TContext = RowView> {
//   execute(): IterableIterator<TContext>;
// }
