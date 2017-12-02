DROP TABLE IF EXISTS `test`.`user`;

CREATE TABLE `test`.`user` (
  `id` BIGINT UNSIGNED NULL AUTO_INCREMENT COMMENT '记录 ID',
  `create_time` timestamp NOT NULL DEFAULT '0000-00-00 00:00:00' COMMENT '创建时间',
  `update_time` timestamp NOT NULL DEFAULT '0000-00-00 00:00:00' COMMENT '更新时间',
  `user_id` varchar(50) NOT NULL COMMENT '用户 ID',
  `user_name` varchar(50) NOT NULL COMMENT '用户名',
  `deleted` boolean NOT NULL DEFAULT 0 COMMENT '是否删除',
  `group_id` varchar(50) NOT NULL DEFAULT 'unknown' COMMENT '组织 ID',
  `note` LONGTEXT COMMENT '备注',

  PRIMARY KEY (`id`),
  UNIQUE INDEX (`user_id` ASC),
  UNIQUE INDEX (`user_name` ASC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT='临时测试';
