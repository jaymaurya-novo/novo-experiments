module.exports = (sequelize, DataTypes) => {
  const ZendeskUsers = sequelize.define('zendesk_users', {
    id: {
      type: DataTypes.UUID,
      field: 'id',
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
      allowNull: false,
    },
    user_id: {
      type: DataTypes.UUID,
      references: {
        model: 'users',
        key: 'id',
      },
      allowNull: false,
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    business_id: {
      type: DataTypes.UUID,
      references: {
        model: 'businesses',
        key: 'id',
      },
      allowNull: false,
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    zendesk_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    meta: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: sequelize.literal('NOW()'),
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: sequelize.literal('NOW()'),
    },
  }, {
    underscored: true,
  });
  ZendeskUsers.prototype.setAssociations = (models) => {
    ZendeskUsers.belongsTo(models.users, { foreignKey: 'user_id', targetKey: 'id' });
  };
  return ZendeskUsers;
};
