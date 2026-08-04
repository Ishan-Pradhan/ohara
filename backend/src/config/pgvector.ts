import { DataTypes, Sequelize, type DataType as SequelizeDataType } from 'sequelize';
import pgvectorSequelize from 'pgvector/sequelize';

// Registers DataTypes.VECTOR onto the `sequelize` package's shared static
// registry (a runtime mutation — pgvector/sequelize ships no type
// declarations for it, hence the typed wrapper below).
pgvectorSequelize.registerTypes(Sequelize);

interface VectorDataTypes {
  VECTOR(dimensions: number): SequelizeDataType;
}

/**
 * DataTypes.VECTOR(dimensions), typed. This is the one deliberate boundary
 * cast for pgvector's untyped runtime registration above — every model with
 * a vector column calls this instead of touching `DataType.VECTOR` directly.
 */
export const vectorType = (dimensions: number): SequelizeDataType =>
  (DataTypes as unknown as VectorDataTypes).VECTOR(dimensions);
