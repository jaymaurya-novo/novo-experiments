module.exports = (sequelize, DataTypes) => {
  const Users = sequelize.define('users', {
    id: {
      type: DataTypes.UUID,
      field: 'id',
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
      allowNull: false,
    },
    first_name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    last_name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    phone: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    address: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    city: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    state: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    zip_code: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    password: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    business_id: {
      type: DataTypes.UUID,
      references: {
        model: 'businesses',
        key: 'id',
      },
      allowNull: false,
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    },
    status: {
      type: DataTypes.ENUM,
      values: ['active', 'pending', 'suspended', 'deleted'],
      defaultValue: 'active',
    },
    notification_preference: {
      type: DataTypes.STRING(50),
      defaultValue: 'email',
      allowNull: false,
    },
    mfa: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    salt: {
      type: DataTypes.TEXT,
      allowNull: false,
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
    core_meta: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    meta:{
      type:DataTypes.JSONB,
      allowNull:true
    },
    address_coordinates: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {}
    },
    middle_name: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    settings:{
      type:DataTypes.JSONB,
      allowNull:true
    },
    tax_id: {
      type: DataTypes.JSONB,
      allowNull: true
    },
    feature_flags: {
      type: DataTypes.JSONB,
      allowNull:true
    },
    selected_platforms: {
      type: DataTypes.JSONB,
      allowNull:true
    },
    referral_code: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    user_preferences: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    referral_reward_amount: {
      type: DataTypes.NUMERIC,
      allowNull: true,
      defaultValue: 40,
    },
  }, {
    underscored: true,
  });

//   Users.prototype.setAssociations = (models) => {
//     Users.belongsTo(models.businesses, { foreignKey: 'business_id', targetKey: 'id' });
//     Users.hasMany(models.referral_users, { foreignKey: 'referrer_user_id', sourceKey: 'id' });
//   };

  return Users;
};
